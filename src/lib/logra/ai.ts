// Capa única de IA de Logra10.
//
// Por defecto todo se ejecuta EN EL DISPOSITIVO (Transformers.js + WebGPU/WASM)
// y nada sale del navegador. El usuario puede activar el modo "nube" en los
// ajustes; solo entonces se usan las funciones de servidor.
import {
  extractQuestions as cloudExtract,
  correctAnswer as cloudCorrect,
  summarizeClass as cloudSummarize,
  convertNotesToQA as cloudConvert,
} from "./ai.functions";
import { localChat, localTranscribe, type ProgressEvent } from "./local-ai";
import { getAISettings } from "./settings";
import { heuristicScore, parseQAFromText } from "./qa-parse";

export type Pair = {
  question: string;
  answer: string;
  is_graphic?: boolean;
  image_index?: number;
  bbox?: { x: number; y: number; w: number; h: number };
};

export type Correction = {
  accuracy: number;
  coverage: number;
  correctness_summary: string;
  errors: Array<{ student_fragment: string; correct_value: string }>;
  missing: Array<{ fragment: string; reason: string }>;
};

type ExtractInput = { text?: string; images?: string[]; considerations?: string };

const isLocal = () => getAISettings().engine === "local";

const IMAGES_NEED_CLOUD =
  "El modo sin conexión no puede leer imágenes ni PDFs escaneados. Sube apuntes en PDF con texto, o activa la IA en la nube desde el botón de ajustes.";

function chunkText(text: string, size = 3500): string[] {
  const parts: string[] = [];
  let buf = "";
  for (const para of text.split(/\n{2,}/)) {
    if ((buf + para).length > size && buf) {
      parts.push(buf);
      buf = "";
    }
    buf += (buf ? "\n\n" : "") + para;
  }
  if (buf.trim()) parts.push(buf);
  return parts.slice(0, 12);
}

// ===== Extracción de pares desde apuntes ya con formato pregunta/respuesta =====
export async function extractQuestions({ data }: { data: ExtractInput }): Promise<{ pairs: Pair[] }> {
  if (!isLocal()) return cloudExtract({ data }) as Promise<{ pairs: Pair[] }>;

  const hasText = !!data.text && data.text.trim().length > 0;
  if (!hasText) throw new Error(IMAGES_NEED_CLOUD);
  const pairs = parseQAFromText(data.text!);
  if (!pairs.length) {
    throw new Error(
      "No se detectaron preguntas en el texto. Revisa que tus apuntes sigan el formato número-pregunta-respuesta, o activa la IA en la nube.",
    );
  }
  return { pairs };
}

// ===== Corrección de respuestas =====
export async function correctAnswer({
  data,
}: {
  data: { question: string; original: string; student: string };
}): Promise<Correction> {
  if (!isLocal()) return cloudCorrect({ data }) as Promise<Correction>;

  const score = heuristicScore(data.original, data.student);
  let summary = "";
  try {
    summary = (
      await localChat(
        [
          {
            role: "system",
            content:
              "Eres un corrector académico. Compara la respuesta del estudiante con la respuesta original del temario y explica en 2-3 frases, en español, qué ha acertado y qué le falta o ha dicho mal. No inventes datos.",
          },
          {
            role: "user",
            content: `Pregunta: ${data.question}\n\nRespuesta original:\n${data.original}\n\nRespuesta del estudiante:\n${data.student}`,
          },
        ],
        { maxTokens: 220 },
      )
    ).trim();
  } catch {
    summary = "";
  }

  return {
    accuracy: score.accuracy,
    coverage: score.coverage,
    correctness_summary:
      summary ||
      `Tu respuesta cubre aproximadamente el ${score.coverage}% de la información de la respuesta original.`,
    errors: [],
    missing: score.missingTerms.map((fragment) => ({
      fragment,
      reason: "Aparece en la respuesta original y no en la tuya.",
    })),
  };
}

// ===== Resumen de clases =====
const SUMMARY_SYSTEM = `Eres un profesor que resume clases para estudiantes de secundaria.
Escribe en español y SOLO en Markdown, con esta estructura exacta:

# Título del tema

## Resumen ejecutivo
(5-8 líneas)

## Conceptos clave
- ...

## Desarrollo resumido
### Apartado
- ...

## Esquema ultrarrápido
- ...

## Posibles preguntas de examen
1. ...

## Lo imprescindible para el examen
⭐ ...

Elimina muletillas, repeticiones y conversación irrelevante. No inventes contenido.`;

export async function summarizeClass({
  data,
}: {
  data: { transcription: string };
}): Promise<{ summary: string; title: string }> {
  if (!isLocal()) return cloudSummarize({ data }) as Promise<{ summary: string; title: string }>;

  const parts = chunkText(data.transcription);
  let source = data.transcription;
  if (parts.length > 1) {
    const notes: string[] = [];
    for (const part of parts) {
      const n = await localChat(
        [
          {
            role: "system",
            content:
              "Resume en español, en viñetas breves, solo la información académicamente relevante de este fragmento de clase. Sin preámbulos.",
          },
          { role: "user", content: part },
        ],
        { maxTokens: 320 },
      );
      notes.push(n.trim());
    }
    source = notes.join("\n");
  }

  const summary = (
    await localChat(
      [
        { role: "system", content: SUMMARY_SYSTEM },
        { role: "user", content: source.slice(0, 6000) },
      ],
      { maxTokens: 900 },
    )
  ).trim();

  const titleMatch = summary.match(/^#\s+(.+)$/m);
  return { summary, title: (titleMatch?.[1] ?? "Clase").trim() };
}

// ===== Conversión de apuntes libres a preguntas/respuestas =====
export async function convertNotesToQA({
  data,
}: {
  data: ExtractInput;
}): Promise<{ pairs: Array<{ question: string; answer: string }>; title: string }> {
  if (!isLocal())
    return cloudConvert({ data }) as Promise<{
      pairs: Array<{ question: string; answer: string }>;
      title: string;
    }>;

  if (!data.text || !data.text.trim()) throw new Error(IMAGES_NEED_CLOUD);

  const pairs: Array<{ question: string; answer: string }> = [];
  for (const part of chunkText(data.text, 2500)) {
    const out = await localChat(
      [
        {
          role: "system",
          content:
            'Conviertes apuntes en preguntas de estudio. Devuelve SOLO líneas con el formato exacto "P: pregunta" seguida de "R: respuesta". Genera todas las preguntas necesarias para cubrir el contenido. No inventes datos que no estén en los apuntes. Escribe en español.',
        },
        { role: "user", content: part },
      ],
      { maxTokens: 700 },
    );
    const lines = out.split("\n");
    let q = "";
    for (const line of lines) {
      const lq = line.match(/^\s*P\s*[:.\-]\s*(.+)$/i);
      const lr = line.match(/^\s*R\s*[:.\-]\s*(.+)$/i);
      if (lq) q = lq[1].trim();
      else if (lr && q) {
        pairs.push({ question: q, answer: lr[1].trim() });
        q = "";
      }
    }
  }

  if (!pairs.length)
    throw new Error(
      "La IA local no consiguió generar preguntas. Prueba con menos texto o activa la IA en la nube.",
    );
  return { pairs, title: "Apuntes convertidos" };
}

// ===== Transcripción de audio =====
export async function transcribeAudio(
  file: File,
  opts: {
    language?: "es" | "en";
    onProgress?: (p: ProgressEvent) => void;
    onStep?: (current: number, total: number) => void;
  } = {},
): Promise<string> {
  if (isLocal()) {
    const { decodeToMono16k } = await import("./audio-chunk");
    const samples = await decodeToMono16k(file);
    return (
      await localTranscribe(samples, {
        language: opts.language === "en" ? "english" : "spanish",
        onProgress: opts.onProgress,
      })
    ).trim();
  }

  const { chunkAudioToWav } = await import("./audio-chunk");
  const chunks = await chunkAudioToWav(file);
  const parts: string[] = [];
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  for (let i = 0; i < chunks.length; i++) {
    opts.onStep?.(i + 1, chunks.length);
    let lastError = "";
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      const fd = new FormData();
      fd.append("file", chunks[i], `chunk-${i}.wav`);
      fd.append("language", opts.language === "en" ? "eng" : "spa");
      const resp = await fetch("/api/transcribe-class", { method: "POST", body: fd });
      const raw = await resp.text();
      let parsed: { text?: string; error?: string; retryable?: boolean } = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        /* respuesta no JSON */
      }
      if (resp.ok) {
        if (parsed.text) parts.push(parsed.text.trim());
        done = true;
        break;
      }
      lastError = parsed.error || raw?.slice(0, 200) || `Error ${resp.status}`;
      const retryable =
        [408, 429, 502, 503, 504].includes(resp.status) || Boolean(parsed.retryable);
      if (!retryable || attempt === 3) break;
      await wait(1200 * attempt);
    }
    if (!done && lastError) throw new Error(lastError);
  }
  return parts.join(" ").trim();
}
