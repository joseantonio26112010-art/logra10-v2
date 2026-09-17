/// <reference lib="webworker" />
// Worker de IA local: ejecuta los modelos dentro del navegador con
// WebGPU (o WASM como respaldo). Nunca sale información del dispositivo.
import { pipeline, env, type ProgressInfo } from "@huggingface/transformers";

env.allowLocalModels = false;

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

let chatPipe: unknown = null;
let chatId = "";
let asrPipe: unknown = null;
let asrId = "";
let device: "webgpu" | "wasm" | null = null;

async function pickDevice(): Promise<"webgpu" | "wasm"> {
  if (device) return device;
  const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
  try {
    device = nav.gpu && (await nav.gpu.requestAdapter()) ? "webgpu" : "wasm";
  } catch {
    device = "wasm";
  }
  return device;
}

function progress(id: number, task: string) {
  return (info: ProgressInfo) => {
    const p = info as unknown as { status?: string; file?: string; progress?: number };
    self.postMessage({
      id,
      type: "progress",
      task,
      status: p.status ?? "",
      file: p.file ?? "",
      percent: typeof p.progress === "number" ? Math.round(p.progress) : undefined,
    });
  };
}

async function getChat(model: string, id: number) {
  if (chatPipe && chatId === model) return chatPipe;
  const dev = await pickDevice();
  chatPipe = await pipeline("text-generation", model, {
    dtype: "q4",
    device: dev,
    progress_callback: progress(id, "chat"),
  });
  chatId = model;
  return chatPipe;
}

async function getAsr(model: string, id: number) {
  if (asrPipe && asrId === model) return asrPipe;
  const dev = await pickDevice();
  asrPipe = await pipeline("automatic-speech-recognition", model, {
    dtype: dev === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
    device: dev,
    progress_callback: progress(id, "asr"),
  });
  asrId = model;
  return asrPipe;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const data = event.data as {
    id: number;
    type: "chat" | "asr" | "warmup";
    model: string;
    asrModel?: string;
    messages?: ChatMsg[];
    maxTokens?: number;
    audio?: Float32Array;
    language?: string;
  };
  const { id, type } = data;
  try {
    if (type === "warmup") {
      await getChat(data.model, id);
      if (data.asrModel) await getAsr(data.asrModel, id);
      self.postMessage({ id, type: "result", result: "ok" });
      return;
    }

    if (type === "chat") {
      const pipe = (await getChat(data.model, id)) as (
        input: ChatMsg[],
        opts: Record<string, unknown>,
      ) => Promise<Array<{ generated_text: ChatMsg[] | string }>>;
      const out = await pipe(data.messages ?? [], {
        max_new_tokens: data.maxTokens ?? 512,
        do_sample: false,
        return_full_text: false,
      });
      const gen = out?.[0]?.generated_text;
      const text = Array.isArray(gen)
        ? String(gen[gen.length - 1]?.content ?? "")
        : String(gen ?? "");
      self.postMessage({ id, type: "result", result: text });
      return;
    }

    if (type === "asr") {
      const pipe = (await getAsr(data.model, id)) as (
        audio: Float32Array,
        opts: Record<string, unknown>,
      ) => Promise<{ text?: string }>;
      const out = await pipe(data.audio as Float32Array, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: data.language ?? "spanish",
        task: "transcribe",
        return_timestamps: false,
      });
      self.postMessage({ id, type: "result", result: out?.text ?? "" });
      return;
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
