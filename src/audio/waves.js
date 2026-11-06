// 이 파일이 하는 일: 소리 파일 없이 파도 소리를 만든다 — 핑크 노이즈(쏴아 소리)를 낮은음만 남기고, 7초 주기로 커졌다 작아지게 해서 밀려왔다 빠지는 느낌
const WAVE_PERIOD = 7;   // 초

function pinkNoiseBuffer(ctx, seconds = 4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Paul Kellet의 간이 핑크 노이즈 필터
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

export function createWaveSound() {
  let ctx = null, nodes = null;
  const api = { playing: false, start, stop };

  function start() {
    if (api.playing) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    ctx.resume?.();
    const src = ctx.createBufferSource();
    src.buffer = pinkNoiseBuffer(ctx);
    src.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / WAVE_PERIOD;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.14;
    lfo.connect(lfoDepth).connect(gain.gain);
    src.connect(lowpass).connect(gain).connect(ctx.destination);
    src.start();
    lfo.start();
    nodes = { src, lfo, gain };
    api.playing = true;
  }

  function stop() {
    if (!api.playing) return;
    try { nodes.src.stop(); nodes.lfo.stop(); nodes.gain.disconnect(); } catch { /* 이미 멈춤 */ }
    nodes = null;
    api.playing = false;
  }

  return api;
}
