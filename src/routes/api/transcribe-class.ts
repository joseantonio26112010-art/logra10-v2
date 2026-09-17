import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/transcribe-class")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.ELEVENLABS_API_KEY;
          if (!apiKey) {
            return json({ error: "ELEVENLABS_API_KEY no configurada" }, 500);
          }

          const form = await request.formData();
          const file = form.get("file") as File | null;
          if (!file || typeof (file as File).arrayBuffer !== "function") {
            return json({ error: "No se recibió ningún archivo de audio" }, 400);
          }

          const language = typeof form.get("language") === "string"
            ? (form.get("language") as string)
            : "spa";

          const apiForm = new FormData();
          apiForm.append("file", file, file.name ?? "audio");
          apiForm.append("model_id", "scribe_v2");
          apiForm.append("language_code", language);
          apiForm.append("tag_audio_events", "false");
          apiForm.append("diarize", "false");

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45_000);
          const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": apiKey },
            body: apiForm,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));

          if (!resp.ok) {
            const detail = await resp.text();
            return json({ error: `Transcripción falló: ${resp.status}`, detail, retryable: resp.status >= 500 || resp.status === 429 }, 502);
          }

          const data = (await resp.json()) as { text?: string };
          return json({ text: data.text ?? "" });
        } catch (e) {
          const aborted = e instanceof Error && e.name === "AbortError";
          return json(
            { error: aborted ? "La transcripción tardó demasiado. Reintentando..." : e instanceof Error ? e.message : "Error desconocido", retryable: aborted },
            aborted ? 504 : 500,
          );
        }
      },
    },
  },
});
