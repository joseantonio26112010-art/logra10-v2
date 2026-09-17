// Decodifica un archivo de audio, lo remuestrea a mono 16 kHz y lo trocea
// en segmentos WAV para transcribir cada uno por separado (evita timeouts
// del proxy con audios largos).

const TARGET_SR = 16000;
const CHUNK_SECONDS = 120; // 2 min por trozo: evita timeouts del proveedor/proxy
const MAX_AUDIO_SECONDS = 60 * 60; // máximo 1 hora

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function decodeAndResample(file: File): Promise<Float32Array> {
  const arrayBuf = await file.arrayBuffer();
  const AC: typeof AudioContext =
    (window.AudioContext as typeof AudioContext) ||
    ((window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext as typeof AudioContext);
  const tmp = new AC();
  const decoded = await tmp.decodeAudioData(arrayBuf.slice(0));
  tmp.close?.();

  const durationSec = decoded.duration;
  if (durationSec > MAX_AUDIO_SECONDS + 1) {
    throw new Error("El audio supera el máximo permitido de 1 hora.");
  }

  const offline = new OfflineAudioContext(
    1,
    Math.ceil(durationSec * TARGET_SR),
    TARGET_SR,
  );
  // Mezclar canales a mono usando un nodo source.
  const src = offline.createBufferSource();
  src.buffer = decoded;
  // Reducir a mono mediante un ChannelMergerNode no: usamos ChannelSplitter+Gain
  // o simplemente conectar a destination que es mono (canales=1).
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice(0);
}

export async function decodeToMono16k(file: File): Promise<Float32Array> {
  return decodeAndResample(file);
}

export async function chunkAudioToWav(file: File): Promise<Blob[]> {
  const samples = await decodeAndResample(file);
  const perChunk = CHUNK_SECONDS * TARGET_SR;
  const chunks: Blob[] = [];
  for (let i = 0; i < samples.length; i += perChunk) {
    const slice = samples.subarray(i, Math.min(i + perChunk, samples.length));
    chunks.push(encodeWav(slice, TARGET_SR));
  }
  return chunks;
}
