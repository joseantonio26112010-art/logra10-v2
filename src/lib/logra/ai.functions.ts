import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(body: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY no configurada");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Límite de uso alcanzado. Inténtalo en unos minutos.");
    if (res.status === 402) throw new Error("Se requieren créditos en tu workspace de Lovable.");
    throw new Error(`AI error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export const extractQuestions = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().max(400_000).optional(),
      images: z.array(z.string().max(8_000_000)).max(20).optional(),
      considerations: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const hasText = !!data.text && data.text.trim().length > 0;
    const hasImages = !!data.images && data.images.length > 0;
    if (!hasText && !hasImages) throw new Error("No se proporcionó contenido a analizar.");

    const system = `Eres un extractor riguroso de pares pregunta-respuesta a partir de apuntes académicos (texto y/o imágenes).
Los apuntes siguen el patrón: una línea con la pregunta y la(s) línea(s) siguientes con la respuesta.
A veces hay un número delante (p.ej. "1." o "1 -"). Una pregunta termina en "?" o se intuye claramente.
REGLAS ESTRICTAS:
- Conserva EXACTAMENTE el texto original tanto de la pregunta como de la respuesta. No resumas, no parafrasees, no añadas nada.
- Cuando el contenido sean imágenes, transcribe literalmente lo que veas, sin corregir ni inventar.
- No inventes contenido. Si no hay respuesta clara para una pregunta, ignórala.
- Devuelve únicamente lo que aparece en el material aportado.
- Si el usuario aporta "Consideraciones del usuario", respétalas (p. ej. limitar páginas o regiones).
RESPUESTAS GRÁFICAS:
- Si la respuesta a una pregunta es principalmente un esquema, dibujo, diagrama, gráfica o tabla visual (no se puede transcribir fielmente como texto), marca el par con is_graphic=true.
- En ese caso, indica image_index (índice 0-based de la imagen aportada en la que está la respuesta) y bbox normalizado entre 0 y 1: { x, y, w, h } que rodee la respuesta gráfica con un poco de margen.
- El campo "answer" debe contener una breve descripción textual de lo que muestra el gráfico, transcribiendo los rótulos/etiquetas visibles tal cual aparecen.
- Si la respuesta es solo texto, deja is_graphic=false y no incluyas image_index ni bbox.`;

    const userContent: Array<Record<string, unknown>> = [];
    const intro = hasText && hasImages
      ? "Extrae todos los pares pregunta-respuesta del texto y de las imágenes aportadas."
      : hasImages
      ? "Extrae todos los pares pregunta-respuesta visibles en las imágenes aportadas."
      : "Extrae todos los pares pregunta-respuesta del siguiente texto.";
    userContent.push({ type: "text", text: intro });
    if (data.considerations && data.considerations.trim()) {
      userContent.push({ type: "text", text: `Consideraciones del usuario:\n${data.considerations.trim()}` });
    }
    if (hasText) {
      userContent.push({ type: "text", text: `Texto:\n${data.text}` });
    }
    if (hasImages) {
      data.images!.forEach((img, i) => {
        userContent.push({ type: "text", text: `Imagen #${i}:` });
        userContent.push({ type: "image_url", image_url: { url: img } });
      });
    }

    const result = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_qa",
            description: "Guarda los pares pregunta-respuesta extraídos",
            parameters: {
              type: "object",
              properties: {
                pairs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      answer: { type: "string" },
                      is_graphic: { type: "boolean" },
                      image_index: { type: "number" },
                      bbox: {
                        type: "object",
                        properties: {
                          x: { type: "number" },
                          y: { type: "number" },
                          w: { type: "number" },
                          h: { type: "number" },
                        },
                        required: ["x", "y", "w", "h"],
                        additionalProperties: false,
                      },
                    },
                    required: ["question", "answer"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["pairs"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_qa" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("La IA no devolvió pares pregunta-respuesta.");
    const args = JSON.parse(toolCall.function.arguments);
    const pairs = (args.pairs ?? []) as Array<{
      question: string;
      answer: string;
      is_graphic?: boolean;
      image_index?: number;
      bbox?: { x: number; y: number; w: number; h: number };
    }>;
    return { pairs };
  });

export const correctAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      question: z.string().min(1).max(4000),
      original: z.string().min(1).max(8000),
      student: z.string().min(1).max(8000),
    }),
  )
  .handler(async ({ data }) => {
    const system = `Eres un corrector académico inteligente y riguroso.
Comparas la respuesta del estudiante con la respuesta original del temario.
NO hagas comparación palabra a palabra: comprende equivalencias semánticas y contexto.
Detecta:
- Errores factuales (fechas, años, nombres propios, lugares, cifras, datos científicos, terminología técnica).
- Información importante que falta respecto a la respuesta original.
Devuelve además:
- accuracy (0-100): % de exactitud factual (penaliza errores).
- coverage (0-100): % de información esperada que cubre la respuesta del estudiante.
- correctness_summary: explicación breve y clara en español.
- errors: lista de fragmentos del texto del ESTUDIANTE que son factualmente incorrectos, con el valor correcto.
- missing: lista de fragmentos importantes de la respuesta ORIGINAL que el estudiante no menciona.
NUNCA modifiques el texto original del temario.`;

    const result = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Pregunta: ${data.question}\n\nRespuesta ORIGINAL (no modificar):\n${data.original}\n\nRespuesta del ESTUDIANTE:\n${data.student}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_correction",
            description: "Guarda la corrección estructurada",
            parameters: {
              type: "object",
              properties: {
                accuracy: { type: "number" },
                coverage: { type: "number" },
                correctness_summary: { type: "string" },
                errors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      student_fragment: { type: "string", description: "Fragmento exacto del texto del estudiante que es incorrecto" },
                      correct_value: { type: "string", description: "Valor correcto según la respuesta original" },
                    },
                    required: ["student_fragment", "correct_value"],
                    additionalProperties: false,
                  },
                },
                missing: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      fragment: { type: "string", description: "Fragmento de la respuesta original que falta" },
                      reason: { type: "string" },
                    },
                    required: ["fragment", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["accuracy", "coverage", "correctness_summary", "errors", "missing"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_correction" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("La IA no devolvió la corrección.");
    return JSON.parse(toolCall.function.arguments) as {
      accuracy: number;
      coverage: number;
      correctness_summary: string;
      errors: Array<{ student_fragment: string; correct_value: string }>;
      missing: Array<{ fragment: string; reason: string }>;
    };
  });

export const summarizeClass = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      transcription: z.string().min(20).max(400_000),
    }),
  )
  .handler(async ({ data }) => {
    const system = `Eres un especialista en análisis de transcripciones educativas, pedagogía, aprendizaje eficiente, síntesis de información y preparación de exámenes. Tu misión es procesar una transcripción textual completa de una clase de 4º ESO y convertirla en un resumen de estudio de máxima calidad. La transcripción puede contener errores de reconocimiento de voz, repeticiones, interrupciones, frases incompletas, comentarios informales, conversaciones irrelevantes y explicaciones improvisadas propias de una clase real.

Analiza la transcripción y extrae exclusivamente la información académicamente relevante. Después, genera un resumen optimizado para estudiar, comprender y preparar exámenes de 4º ESO con la máxima eficiencia posible.

Ejecuta estas fases:

FASE 1 — Limpieza y comprensión
- Corrige errores evidentes de transcripción cuando el contexto permita identificar el significado correcto.
- Ignora saludos, conversaciones ajenas, pausas, muletillas, bromas, interrupciones y contenido sin valor educativo.
- Cuando una idea aparece explicada varias veces, conserva sólo la versión más clara y completa.
- Reconstruye explicaciones fragmentadas.
- Identifica cambios de tema y organiza el contenido en bloques temáticos.

FASE 2 — Extracción de información
- Extrae definiciones, conceptos, fórmulas, procesos, reglas, fechas, nombres, clasificaciones, relaciones causa-efecto y todo lo susceptible de examen.
- Distingue información principal y secundaria.
- Identifica las ideas enfatizadas por el profesor ("esto es importante", "suele caer", "recordad esto", "es fundamental", etc.).
- Conserva sólo los ejemplos imprescindibles para comprender conceptos complejos.

FASE 3 — Síntesis optimizada
- Reduce al mínimo número de palabras sin perder información importante.
- Reescribe en conceptos claros y memorizables.
- Prioriza listas, esquemas, tablas y estructuras visuales.
- Organiza de lo general a lo específico.
- Presenta procesos paso a paso.
- Crea comparaciones para conceptos parecidos.

FASE 4 — Optimización para examen
- Identifica el contenido con mayor probabilidad de evaluación.
- Destaca conceptos críticos con ⭐.
- Crea sección final con lo imprescindible para aprobar y sacar la máxima nota.
- Incluye potenciales preguntas de examen.

REQUISITOS:
- Reduce el volumen entre 75% y 90% siempre que sea posible.
- Mantén el 100% de la información académicamente relevante.
- Autocontenido y comprensible sin la transcripción.
- Optimizado para repasos de 5-10 minutos.
- Lenguaje claro adaptado a 4º ESO.
- Sin redundancias.
- Visualmente escaneable.

FORMATO DE SALIDA OBLIGATORIO (Markdown exacto, sin envoltorios ni preámbulos):

# [Nombre del tema]

## Resumen ejecutivo
Síntesis de las ideas fundamentales en 5-10 líneas.

## Conceptos clave
- Concepto 1
- Concepto 2
- Concepto 3

## Desarrollo resumido

### [Apartado]
- Idea principal
- Idea secundaria
- Dato relevante ⭐

### [Apartado]
- Idea principal
- Idea secundaria
- Dato relevante ⭐

## Esquema ultrarrápido
- Punto clave 1
- Punto clave 2
- Punto clave 3
- Punto clave 4

## Tabla comparativa (si procede)

| Concepto | Características | Diferencias clave |
|-----------|-----------------|-------------------|
| ... | ... | ... |

## Posibles preguntas de examen
1. ...
2. ...
3. ...

## Lo imprescindible para el examen
⭐ ...
⭐ ...
⭐ ...
⭐ ...

## Resumen de 1 minuto
(Máximo 10 líneas con lo absolutamente esencial)

Devuelve únicamente el markdown del resumen. No expliques tu proceso ni añadas frases introductorias.`;

    const result = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Transcripción de la clase:\n\n${data.transcription}` },
      ],
    });

    const text: string = result.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error("La IA no devolvió un resumen.");

    // Intenta extraer un título razonable a partir del primer "# ..." del markdown.
    const firstHeading = /^#\s+(.+)$/m.exec(text);
    const title = firstHeading?.[1]?.trim().slice(0, 120) || "Clase sin título";
    return { summary: text.trim(), title };
  });

export const convertNotesToQA = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().max(400_000).optional(),
      images: z.array(z.string().max(8_000_000)).max(20).optional(),
      considerations: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const hasText = !!data.text && data.text.trim().length > 0;
    const hasImages = !!data.images && data.images.length > 0;
    if (!hasText && !hasImages) throw new Error("No se proporcionó contenido a convertir.");

    const system = `Eres un experto en transformar apuntes académicos (resúmenes, esquemas, párrafos, listas, tablas, diagramas) en un conjunto EXHAUSTIVO de pares pregunta-respuesta listos para estudiar.

OBJETIVO:
- Cubrir TODA la información relevante de los apuntes aportados (texto e imágenes).
- Generar tantas preguntas como sea necesario para no dejar fuera ningún concepto, definición, fecha, nombre propio, fórmula, clasificación, causa, consecuencia, ejemplo importante o dato susceptible de examen.
- Mejor pasarse en cobertura que quedarse corto: extrae al máximo.

REGLAS DE FORMATO:
- Las preguntas deben ser claras, concretas y autocontenidas (no del tipo "¿Qué dice el texto?").
- Las respuestas deben ser fieles al contenido original: no inventes datos ni añadas información que no aparezca en los apuntes.
- Las respuestas deben ser completas pero concisas, redactadas con tus propias palabras cuando ayude a la claridad, manteniendo SIEMPRE la exactitud de los hechos, cifras, fechas y nombres.
- Si un mismo bloque contiene varios conceptos, genera VARIAS preguntas (una por concepto).
- Si aparecen listas/clasificaciones, crea una pregunta por la lista completa Y, si procede, preguntas individuales por cada elemento importante.
- Si hay imágenes con esquemas/diagramas/tablas, transcribe la información a texto y genera preguntas sobre ella.
- No inventes contenido que no esté en los apuntes.
- Si el usuario aporta "Consideraciones del usuario", respétalas.

SALIDA:
Llama a la función save_qa con un array "pairs" de objetos { question, answer }. Sin envoltorios ni explicaciones.`;

    const userContent: Array<Record<string, unknown>> = [];
    const intro = hasText && hasImages
      ? "Convierte estos apuntes (texto e imágenes) en el conjunto más completo posible de pares pregunta-respuesta."
      : hasImages
      ? "Convierte los apuntes visibles en las imágenes en el conjunto más completo posible de pares pregunta-respuesta."
      : "Convierte el siguiente texto de apuntes en el conjunto más completo posible de pares pregunta-respuesta.";
    userContent.push({ type: "text", text: intro });
    if (data.considerations && data.considerations.trim()) {
      userContent.push({ type: "text", text: `Consideraciones del usuario:\n${data.considerations.trim()}` });
    }
    if (hasText) {
      userContent.push({ type: "text", text: `Apuntes:\n${data.text}` });
    }
    if (hasImages) {
      data.images!.forEach((img, i) => {
        userContent.push({ type: "text", text: `Imagen #${i}:` });
        userContent.push({ type: "image_url", image_url: { url: img } });
      });
    }

    const result = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_qa",
            description: "Guarda los pares pregunta-respuesta generados",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título breve del tema cubierto por los apuntes" },
                pairs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      answer: { type: "string" },
                    },
                    required: ["question", "answer"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["pairs"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_qa" } },
    });

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("La IA no devolvió pares pregunta-respuesta.");
    const args = JSON.parse(toolCall.function.arguments);
    const pairs = (args.pairs ?? []) as Array<{ question: string; answer: string }>;
    const title = (args.title as string | undefined)?.trim() || "Apuntes convertidos";
    return { pairs, title };
  });
