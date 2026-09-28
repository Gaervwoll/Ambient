// wav-generator.js
// Генерирует зацикленные WAV-буферы (эмбиент) и отдаёт Blob.

export const PRESETS = [
  { name: 'Deep',    partials: [55, 82.5, 110, 164.8],  noiseLP: 0.95, amRate: 0.10, gain: 0.7 },
  { name: 'Warm',    partials: [65.4, 98, 130.8, 196],  noiseLP: 0.92, amRate: 0.07, gain: 0.6 },
  { name: 'Air',     partials: [110, 165, 220, 329.6],  noiseLP: 0.88, amRate: 0.15, gain: 0.5 },
  { name: 'Dark',    partials: [41.2, 61.7, 82.4, 123.5], noiseLP: 0.97, amRate: 0.05, gain: 0.8 },
];

/**
 * Генерирует WAV (mono, 16-bit PCM) с бесшовным циклом.
 * @param {object} preset — из PRESETS
 * @param {number} durationSec — длина цикла
 * @param {number} sampleRate
 * @returns {Blob}
 */
export function generateWav(preset, durationSec = 12, sampleRate = 22050) {
  const len = durationSec * sampleRate;
  const data = new Float32Array(len);

  // Чтобы цикл был бесшовным, все частоты (включая AM и шум-модуляцию)
  // должны укладываться в целое число периодов на durationSec.
  const partials = preset.partials.map(f => {
    const cycles = Math.max(1, Math.round(f * durationSec));
    return { f: cycles / durationSec, a: 1 };
  });
  const amCycles = Math.max(1, Math.round(preset.amRate * durationSec));
  const amFreq = amCycles / durationSec;

  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;

    let s = 0;
    for (const p of partials) {
      s += Math.sin(2 * Math.PI * p.f * t);
    }
    s /= partials.length;

    // шум (low-pass, коэф. из пресета)
    const white = Math.random() * 2 - 1;
    lp = lp * preset.noiseLP + white * (1 - preset.noiseLP);
    s = s * 0.5 + lp * 1.2;

    // амплитудная модуляция
    s *= 0.8 + 0.2 * Math.sin(2 * Math.PI * amFreq * t);

    data[i] = Math.max(-1, Math.min(1, s * preset.gain));
  }

  return encodeWav(data, sampleRate);
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    let v = samples[i];
    v = v < 0 ? v * 0x8000 : v * 0x7fff;
    view.setInt16(off, v, true);
    off += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}