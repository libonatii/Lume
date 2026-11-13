// Cliente centralizado para provedores OpenAI-compatible (Node e Cloudflare Workers).
// A chave nunca sai do servidor nem é registrada em logs.

import { AppError } from '../errors.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 20_000;

export class AIError extends AppError {
  constructor(message, code = 'ai_upstream_error', status = 502) {
    super(message, code, status);
    this.name = 'AIError';
  }
}

export function aiConfig(env = {}) {
  const enabled = String(env?.LUME_AI_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
  const key = String(env?.LUME_AI_API_KEY || env?.OPENAI_API_KEY || '').trim();
  const baseUrl = String(env?.LUME_AI_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
  const model = String(env?.LUME_AI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const parsedTimeout = Number(env?.LUME_AI_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? Math.min(parsedTimeout, 120_000) : DEFAULT_TIMEOUT_MS;
  return {
    enabled,
    configured: enabled && Boolean(key),
    key,
    baseUrl,
    model,
    timeoutMs,
  };
}

export function aiAvailable(env = {}) {
  return aiConfig(env).configured;
}

export function stripMarkdownJsonFence(text) {
  const raw = String(text ?? '').trim();
  if (!raw.startsWith('```')) return raw;
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function linkAbortSignals(timeoutMs, externalSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    controller,
    didTimeout: () => timedOut,
    cleanup() {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    },
  };
}

function safeLog(log, payload) {
  if (typeof log !== 'function') return;
  try {
    log('ai_completion', payload);
  } catch {
    // Falha de log nunca derruba a chamada.
  }
}

function buildPayload(options, config, { stream = false } = {}) {
  const payload = {
    model: options.model || config.model,
    temperature: options.temperature ?? 0.2,
    messages: options.messages,
  };
  if (options.maxTokens != null) payload.max_tokens = options.maxTokens;
  if (options.responseFormat) payload.response_format = options.responseFormat;
  if (stream) payload.stream = true;
  return payload;
}

function classifyHttpError(status) {
  if (status === 429) {
    return new AIError('Limite de requisições da IA atingido. Tente novamente em instantes.', 'ai_rate_limited', 429);
  }
  return new AIError('A IA não respondeu agora. Tente novamente em instantes.', 'ai_upstream_error', 502);
}

export async function chatCompletion(options, { env = {}, fetchImpl = fetch, log } = {}) {
  const config = aiConfig(env);
  if (!config.configured) {
    throw new AIError('Serviço de IA não configurado neste servidor.', 'ai_unavailable', 503);
  }
  const model = options.model || config.model;
  const feature = options.feature || 'unknown';
  const startedAt = Date.now();
  const { signal, didTimeout, cleanup } = linkAbortSignals(options.timeoutMs || config.timeoutMs, options.signal);
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify(buildPayload(options, config)),
    });
    if (!response.ok) {
      const err = classifyHttpError(response.status);
      safeLog(log, { feature, model, status: err.code, httpStatus: response.status, durationMs: Date.now() - startedAt });
      throw err;
    }
    const data = await response.json();
    const messageContent = data?.choices?.[0]?.message?.content;
    if (typeof messageContent !== 'string' || !messageContent.trim()) {
      safeLog(log, { feature, model, status: 'ai_invalid_response', durationMs: Date.now() - startedAt });
      throw new AIError('A IA devolveu uma resposta vazia ou inválida.', 'ai_invalid_response', 502);
    }
    const usage = data?.usage || {};
    safeLog(log, {
      feature,
      model: data?.model || model,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
    });
    return {
      content: messageContent,
      model: data?.model || model,
      usage,
    };
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (error?.name === 'AbortError' || didTimeout()) {
      safeLog(log, { feature, model, status: 'ai_timeout', durationMs: Date.now() - startedAt });
      throw new AIError('A IA demorou mais do que o esperado para responder.', 'ai_timeout', 504);
    }
    safeLog(log, { feature, model, status: 'ai_upstream_error', durationMs: Date.now() - startedAt });
    throw new AIError('A IA não respondeu agora. Tente novamente em instantes.', 'ai_upstream_error', 502);
  } finally {
    cleanup();
  }
}

export async function jsonCompletion(options, deps = {}) {
  const result = await chatCompletion({
    ...options,
    temperature: options.temperature ?? 0,
    responseFormat: options.responseFormat ?? { type: 'json_object' },
  }, deps);
  let parsed;
  try {
    parsed = JSON.parse(stripMarkdownJsonFence(result.content));
  } catch {
    throw new AIError('A IA devolveu um JSON inválido.', 'ai_invalid_response', 502);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AIError('A IA devolveu uma resposta inválida.', 'ai_invalid_response', 502);
  }
  if (typeof options.validate === 'function') {
    let validated;
    try {
      validated = options.validate(parsed);
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError('A IA devolveu uma resposta fora do formato esperado.', 'ai_invalid_response', 502);
    }
    if (!validated) {
      throw new AIError('A IA devolveu uma resposta fora do formato esperado.', 'ai_invalid_response', 502);
    }
    return { data: validated, model: result.model, usage: result.usage };
  }
  return { data: parsed, model: result.model, usage: result.usage };
}

export async function streamCompletion(options, { env = {}, fetchImpl = fetch, log } = {}) {
  const config = aiConfig(env);
  if (!config.configured) {
    throw new AIError('Serviço de IA não configurado neste servidor.', 'ai_unavailable', 503);
  }
  const model = options.model || config.model;
  const feature = options.feature || 'unknown';
  const startedAt = Date.now();
  const { signal, controller, didTimeout, cleanup } = linkAbortSignals(options.timeoutMs || Math.max(config.timeoutMs, 45_000), options.signal);
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify(buildPayload(options, config, { stream: true })),
    });
    if (!response.ok) {
      cleanup();
      const err = classifyHttpError(response.status);
      safeLog(log, { feature, model, status: err.code, httpStatus: response.status, durationMs: Date.now() - startedAt });
      throw err;
    }
    if (!response.body) {
      cleanup();
      throw new AIError('O provedor de IA não enviou stream de resposta.', 'ai_invalid_response', 502);
    }
    return {
      body: response.body,
      model,
      abort: () => controller.abort(),
      cleanup: () => {
        cleanup();
        safeLog(log, { feature, model, status: 'ok', durationMs: Date.now() - startedAt });
      },
    };
  } catch (error) {
    cleanup();
    if (error instanceof AIError) throw error;
    if (error?.name === 'AbortError' || didTimeout()) {
      safeLog(log, { feature, model, status: 'ai_timeout', durationMs: Date.now() - startedAt });
      throw new AIError('A IA demorou mais do que o esperado para responder.', 'ai_timeout', 504);
    }
    safeLog(log, { feature, model, status: 'ai_upstream_error', durationMs: Date.now() - startedAt });
    throw new AIError('A IA não respondeu agora. Tente novamente em instantes.', 'ai_upstream_error', 502);
  }
}

// Lê um stream SSE OpenAI-compatible, invocando `onDelta(chunk)` e devolvendo o conteúdo completo.
export async function readOpenAIStream(body, { onDelta, cleanup } = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) {
            fullText += delta;
            if (typeof onDelta === 'function') await onDelta(delta, fullText);
          }
        } catch {
          // Ignora linhas SSE parciais ou comentários.
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
    if (typeof cleanup === 'function') cleanup();
  }
  return fullText;
}
