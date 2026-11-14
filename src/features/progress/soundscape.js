// Sons de fundo da Sessão de Foco, gerados no próprio navegador com Web Audio.
// Não há arquivo de áudio nem rede: um ruído filtrado em laço. É conforto
// sonoro opcional, sem promessa de efeito sobre atenção ou saúde.

export const SOUNDSCAPES = [
  { id: 'rain', title: 'Chuva', hint: 'Ruído grave e abafado', icon: 'rain' },
  { id: 'pink', title: 'Biblioteca', hint: 'Murmúrio constante', icon: 'book' },
  { id: 'white', title: 'Ruído branco', hint: 'Cobre sons do ambiente', icon: 'wave' },
  { id: 'off', title: 'Silêncio', hint: 'Sem áudio', icon: 'mute' },
];

function noiseBuffer(context, kind) {
  const length = context.sampleRate * 4;
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === 'rain') {
        // Ruído marrom: passeio aleatório suavizado.
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else if (kind === 'pink') {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      } else {
        data[i] = white * 0.35;
      }
    }
  }
  return buffer;
}

export function createSoundscape() {
  let context = null;
  let source = null;
  let gain = null;
  let volume = 0.45;

  function stop() {
    if (source) {
      try { source.stop(); } catch { /* já parado */ }
      source.disconnect();
      source = null;
    }
  }

  return {
    play(rawKind) {
      stop();
      const kind = rawKind === 'library' ? 'pink' : rawKind === 'noise' ? 'white' : rawKind;
      if (kind === 'off') return;
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      context ||= new Context();
      if (context.state === 'suspended') context.resume();
      gain ||= context.createGain();
      gain.gain.value = volume * 0.6;
      gain.connect(context.destination);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = kind === 'rain' ? 900 : kind === 'pink' ? 2400 : 8000;
      source = context.createBufferSource();
      source.buffer = noiseBuffer(context, kind);
      source.loop = true;
      source.connect(filter).connect(gain);
      source.start();
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (gain) gain.gain.value = volume * 0.6;
    },
    // Sino curto e baixo ao fim de um ciclo. Toca mesmo em silêncio de fundo.
    chime() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      context ||= new Context();
      const tone = context.createOscillator();
      const envelope = context.createGain();
      tone.type = 'sine';
      tone.frequency.value = 660;
      envelope.gain.setValueAtTime(0.0001, context.currentTime);
      envelope.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.05);
      envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.6);
      tone.connect(envelope).connect(context.destination);
      tone.start();
      tone.stop(context.currentTime + 1.7);
    },
    close() {
      stop();
      if (context) context.close();
      context = null;
      gain = null;
    },
  };
}

// Aviso sonoro de mensagem nova: dois tons curtos e baixos. Usa um contexto próprio,
// criado no primeiro uso; o navegador pode mantê-lo suspenso até a pessoa interagir
// com a página, e nesse caso o aviso visual continua valendo.
let pingContext = null;
export function playMessagePing() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    pingContext ||= new Context();
    if (pingContext.state === 'suspended') pingContext.resume().catch(() => {});
    const start = pingContext.currentTime;
    [[880, 0], [1175, 0.14]].forEach(([frequency, delay]) => {
      const tone = pingContext.createOscillator();
      const envelope = pingContext.createGain();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      envelope.gain.setValueAtTime(0.0001, start + delay);
      envelope.gain.exponentialRampToValueAtTime(0.14, start + delay + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.45);
      tone.connect(envelope).connect(pingContext.destination);
      tone.start(start + delay);
      tone.stop(start + delay + 0.5);
    });
  } catch { /* Sem áudio disponível: fica só o aviso visual. */ }
}
