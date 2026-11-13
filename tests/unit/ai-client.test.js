import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIError, aiAvailable, aiConfig, chatCompletion, jsonCompletion, readOpenAIStream, streamCompletion, stripMarkdownJsonFence,
} from '../../api/domain/ai-client.js';

const ENV = {
  LUME_AI_API_KEY: 'sk-test-secret',
  LUME_AI_BASE_URL: 'https://ai.example.test/v1/',
  LUME_AI_MODEL: 'gpt-test',
};

test('aiConfig e aiAvailable respeitam chave, fallback OPENAI_API_KEY e kill switch LUME_AI_ENABLED', () => {
  assert.equal(aiAvailable({}), false);
  assert.equal(aiAvailable({ OPENAI_API_KEY: 'sk-openai' }), true);
  assert.equal(aiAvailable({ ...ENV, LUME_AI_ENABLED: 'false' }), false);

  const cfg = aiConfig(ENV);
  assert.equal(cfg.configured, true);
  assert.equal(cfg.baseUrl, 'https://ai.example.test/v1');
  assert.equal(cfg.model, 'gpt-test');
});

test('chatCompletion envia payload OpenAI-compatible e registra log sem vazar chave ou prompt', async () => {
  const logs = [];
  let capturedUrl = '';
  let capturedInit = null;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(JSON.stringify({
      model: 'gpt-test',
      choices: [{ message: { content: 'Resumo pronto.' } }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await chatCompletion({
    feature: 'pdf_insights',
    messages: [{ role: 'user', content: 'Conteúdo privado do aluno' }],
  }, { env: ENV, fetchImpl, log: (event, data) => logs.push({ event, data }) });

  assert.equal(capturedUrl, 'https://ai.example.test/v1/chat/completions');
  assert.equal(capturedInit.headers.authorization, 'Bearer sk-test-secret');
  assert.equal(result.content, 'Resumo pronto.');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'ai_completion');
  assert.equal(logs[0].data.status, 'ok');
  assert.equal(logs[0].data.promptTokens, 12);
  assert.equal(JSON.stringify(logs).includes('sk-test-secret'), false);
  assert.equal(JSON.stringify(logs).includes('Conteúdo privado'), false);
});

test('jsonCompletion remove cercas markdown e valida schema', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '```json\n{"overview":"Texto","ok":true}\n```' } }],
  }), { status: 200 });

  const result = await jsonCompletion({
    feature: 'pdf_insights',
    messages: [{ role: 'user', content: 'teste' }],
    validate: (parsed) => (parsed.ok ? { overview: parsed.overview } : null),
  }, { env: ENV, fetchImpl });

  assert.deepEqual(result.data, { overview: 'Texto' });
  assert.equal(stripMarkdownJsonFence('```json\n{"a":1}\n```'), '{"a":1}');
});

test('jsonCompletion rejeita JSON inválido ou fora do schema com AIError ai_invalid_response', async () => {
  const badJsonFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: 'não é json' } }],
  }), { status: 200 });

  await assert.rejects(
    () => jsonCompletion({ messages: [{ role: 'user', content: 'x' }] }, { env: ENV, fetchImpl: badJsonFetch }),
    (err) => err instanceof AIError && err.code === 'ai_invalid_response' && err.status === 502,
  );

  const badSchemaFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{"wrong":true}' } }],
  }), { status: 200 });

  await assert.rejects(
    () => jsonCompletion({
      messages: [{ role: 'user', content: 'x' }],
      validate: (p) => (p.overview ? p : null),
    }, { env: ENV, fetchImpl: badSchemaFetch }),
    (err) => err instanceof AIError && err.code === 'ai_invalid_response' && err.status === 502,
  );
});

test('chatCompletion mapeia 429, 500, timeout e servidor sem chave', async () => {
  await assert.rejects(
    () => chatCompletion({ messages: [{ role: 'user', content: 'x' }] }, { env: {} }),
    (err) => err instanceof AIError && err.code === 'ai_unavailable' && err.status === 503,
  );

  await assert.rejects(
    () => chatCompletion({ messages: [{ role: 'user', content: 'x' }] }, {
      env: ENV,
      fetchImpl: async () => new Response('rate limit', { status: 429 }),
    }),
    (err) => err instanceof AIError && err.code === 'ai_rate_limited' && err.status === 429,
  );

  await assert.rejects(
    () => chatCompletion({ messages: [{ role: 'user', content: 'x' }] }, {
      env: ENV,
      fetchImpl: async () => new Response('erro', { status: 500 }),
    }),
    (err) => err instanceof AIError && err.code === 'ai_upstream_error' && err.status === 502,
  );

  await assert.rejects(
    () => chatCompletion({ messages: [{ role: 'user', content: 'x' }], timeoutMs: 15 }, {
      env: ENV,
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
    }),
    (err) => err instanceof AIError && err.code === 'ai_timeout' && err.status === 504,
  );
});

test('streamCompletion e readOpenAIStream repassam deltas SSE e acumulam resposta final', async () => {
  const sseChunks = [
    'data: {"choices":[{"delta":{"content":"Olá "}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"mundo!"}}]}\n\n',
    'data: [DONE]\n\n',
  ];
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of sseChunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  const streamRes = await streamCompletion({
    feature: 'pdf_insights',
    messages: [{ role: 'user', content: 'oi' }],
  }, {
    env: ENV,
    fetchImpl: async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  });

  const deltas = [];
  const full = await readOpenAIStream(streamRes.body, {
    onDelta: (delta) => deltas.push(delta),
    cleanup: streamRes.cleanup,
  });

  assert.deepEqual(deltas, ['Olá ', 'mundo!']);
  assert.equal(full, 'Olá mundo!');
});
