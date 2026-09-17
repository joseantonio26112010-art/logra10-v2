// Puente con el worker de IA local. Carga perezosa: el worker (y por tanto
// el modelo) solo se crea la primera vez que se necesita.
import { MODELS, getAISettings } from "./settings";

export type ProgressEvent = {
  task: string;
  status: string;
  file: string;
  percent?: number;
};

type Pending = {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
  onProgress?: (p: ProgressEvent) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

const progressListeners = new Set<(p: ProgressEvent) => void>();
export function onLocalAIProgress(fn: (p: ProgressEvent) => void): () => void {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./local-ai.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as {
      id: number;
      type: "progress" | "result" | "error";
      result?: string;
      error?: string;
    } & ProgressEvent;
    const entry = pending.get(d.id);
    if (d.type === "progress") {
      const p: ProgressEvent = {
        task: d.task,
        status: d.status,
        file: d.file,
        percent: d.percent,
      };
      entry?.onProgress?.(p);
      progressListeners.forEach((l) => l(p));
      return;
    }
    if (!entry) return;
    pending.delete(d.id);
    if (d.type === "error") entry.reject(new Error(d.error ?? "Error de la IA local"));
    else entry.resolve(d.result ?? "");
  });
  return worker;
}

function send(payload: Record<string, unknown>, onProgress?: (p: ProgressEvent) => void) {
  const id = ++seq;
  const w = getWorker();
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage({ ...payload, id });
  });
}

export function localChat(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  opts?: { maxTokens?: number; onProgress?: (p: ProgressEvent) => void },
): Promise<string> {
  const { tier } = getAISettings();
  return send(
    { type: "chat", model: MODELS[tier].chat, messages, maxTokens: opts?.maxTokens ?? 640 },
    opts?.onProgress,
  );
}

export function localTranscribe(
  audio: Float32Array,
  opts?: { language?: string; onProgress?: (p: ProgressEvent) => void },
): Promise<string> {
  const { tier } = getAISettings();
  return send(
    { type: "asr", model: MODELS[tier].asr, audio, language: opts?.language ?? "spanish" },
    opts?.onProgress,
  );
}

export function warmupLocalAI(onProgress?: (p: ProgressEvent) => void): Promise<string> {
  const { tier } = getAISettings();
  return send(
    { type: "warmup", model: MODELS[tier].chat, asrModel: MODELS[tier].asr },
    onProgress,
  );
}

export function resetLocalAI() {
  worker?.terminate();
  worker = null;
  pending.clear();
}
