import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  Sparkles,
  Upload,
  Mic,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  ChevronLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Store, type ClassSummary } from "@/lib/logra/storage";
import { summarizeClass, transcribeAudio } from "@/lib/logra/ai";
import { useI18n } from "@/lib/logra/i18n";

export const Route = createFileRoute("/_app/classes")({
  head: () => ({ meta: [{ title: "Clases — Logra10" }] }),
  component: ClassesPage,
});

// Normaliza el markdown del resumen: convierte saltos de línea simples
// en saltos de párrafo para que se respete el espaciado, pero preserva
// listas, tablas, encabezados y bloques de código.
function normalizeSummary(md: string): string {
  if (!md) return md;
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;
  const isBlock = (l: string) =>
    /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\||---|===)/.test(l) || /^\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    out.push(line);
    if (inFence) continue;
    const next = lines[i + 1];
    if (next === undefined) continue;
    // Si la línea actual y la siguiente son ambas "texto normal", inserta línea en blanco
    if (line.trim() !== "" && next.trim() !== "" && !isBlock(line) && !isBlock(next)) {
      out.push("");
    }
  }
  return out.join("\n");
}

type Mode = { kind: "list" } | { kind: "new" } | { kind: "view"; id: string } | { kind: "edit"; id: string };

function ClassesPage() {
  const { t, lang } = useI18n();
  const summarize = summarizeClass;
  const [rows, setRows] = useState<ClassSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  // form state (new)
  const [transcription, setTranscription] = useState("");
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  // edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");

  useEffect(() => {
    Store.hydrateClasses().then((r) => {
      setRows(r);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) Store.saveClasses(rows);
  }, [rows, loaded]);

  useEffect(() => {
    const handler = () => { if (loaded) Store.saveClasses(rows); };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
      if (loaded) Store.saveClasses(rows);
    };
  }, [rows, loaded]);

  async function onFile(file: File) {
    try {
      const text = await file.text();
      setTranscription((prev) => (prev ? prev + "\n\n" + text : text));
    } catch {
      toast.error("No se pudo leer el archivo");
    }
  }

  async function onAudio(file: File) {
    setTranscribing(true);
    try {
      const full = await transcribeAudio(file, {
        language: lang === "en" ? "en" : "es",
        onStep: (i, total) => {
          if (total > 1) toast.message(`${t("transcribing_audio")} (${i}/${total})`);
        },
        onProgress: (p) => {
          if (typeof p.percent === "number" && p.percent % 25 === 0) {
            toast.message(`${t("transcribing_audio")} · ${p.percent}%`);
          }
        },
      });
      if (!full) throw new Error(t("err_transcription_failed"));
      setTranscription((prev) => (prev ? prev + "\n\n" + full : full));
      toast.success(t("audio_transcribed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("err_transcription_failed"));
    } finally {
      setTranscribing(false);
    }
  }

  async function generate() {
    if (transcription.trim().length < 20) {
      toast.error(t("err_empty_transcription"));
      return;
    }
    setLoading(true);
    try {
      const { summary, title } = await summarize({ data: { transcription } });
      const row: ClassSummary = {
        id: crypto.randomUUID(),
        title,
        date: new Date().toISOString().slice(0, 10),
        summary,
        createdAt: Date.now(),
      };
      const next = [row, ...rows];
      setRows(next);
      Store.saveClasses(next);
      setTranscription("");
      setMode({ kind: "view", id: row.id });
      toast.success(t("class_saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generando el resumen");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(c: ClassSummary) {
    setEditTitle(c.title);
    setEditDate(c.date);
    setMode({ kind: "edit", id: c.id });
  }

  function saveEdit() {
    const id = (mode as { id: string }).id;
    const next = rows.map((x) => (x.id === id ? { ...x, title: editTitle, date: editDate } : x));
    setRows(next);
    Store.saveClasses(next);
    setMode({ kind: "view", id });
  }

  function remove(id: string) {
    if (!confirm(t("confirm_delete_class"))) return;
    const next = rows.filter((x) => x.id !== id);
    setRows(next);
    Store.saveClasses(next);
    setMode({ kind: "list" });
  }

  const current =
    mode.kind === "view" || mode.kind === "edit"
      ? rows.find((r) => r.id === mode.id) ?? null
      : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("classes_heading")}</h1>
          <p className="text-muted-foreground text-sm">{t("classes_subtitle")}</p>
        </div>
        {mode.kind === "list" ? (
          <Button onClick={() => setMode({ kind: "new" })}>
            <Plus className="size-4 mr-2" /> {t("new_class")}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setMode({ kind: "list" })}>
            <ChevronLeft className="size-4 mr-2" /> {t("back_menu")}
          </Button>
        )}
      </div>

      {mode.kind === "new" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> {t("new_class")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("transcription_label")}</label>
              <Textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder={t("transcription_placeholder")}
                className="min-h-64"
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,text/plain,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={audioRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAudio(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={loading || transcribing}
              >
                <Upload className="size-4 mr-2" /> {t("or_upload_txt")}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => audioRef.current?.click()}
                disabled={loading || transcribing}
              >
                {transcribing ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Mic className="size-4 mr-2" />
                )}
                {transcribing ? t("transcribing_audio") : t("or_upload_audio")}
              </Button>
              <Button className="ml-auto" onClick={generate} disabled={loading || transcribing}>
                {loading ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="size-4 mr-2" />
                )}
                {loading ? t("summarizing") : t("summarize_class")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode.kind === "view" && current && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-2xl">{current.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{current.date}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => startEdit(current)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(current.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <article className="prose prose-base dark:prose-invert max-w-none leading-relaxed [&>*]:my-3 [&>h1]:mt-6 [&>h2]:mt-6 [&>h3]:mt-5 [&>h1]:mb-3 [&>h2]:mb-3 [&>h3]:mb-2 [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_li]:my-1 [&_li>p]:my-1 [&_hr]:my-6 [&_blockquote]:my-4 [&_pre]:my-4">
              <div className="overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <table
                        {...props}
                        className="w-full my-5 border-collapse border border-border rounded-md overflow-hidden text-sm"
                      />
                    ),
                    thead: ({ node, ...props }) => (
                      <thead {...props} className="bg-muted" />
                    ),
                    th: ({ node, ...props }) => (
                      <th
                        {...props}
                        className="border border-border px-3 py-2 text-left font-semibold"
                      />
                    ),
                    td: ({ node, ...props }) => (
                      <td
                        {...props}
                        className="border border-border px-3 py-2 align-top"
                      />
                    ),
                    h1: ({ node, ...props }) => (
                      <h1 {...props} className="text-2xl font-bold mt-6 mb-3" />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 {...props} className="text-xl font-semibold mt-6 mb-3" />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3 {...props} className="text-lg font-semibold mt-5 mb-2" />
                    ),
                    p: ({ node, ...props }) => (
                      <p {...props} className="my-3 leading-relaxed" />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul {...props} className="list-disc pl-6 my-3 space-y-1" />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol {...props} className="list-decimal pl-6 my-3 space-y-1" />
                    ),
                  }}
                >
                  {normalizeSummary(current.summary)}
                </ReactMarkdown>
              </div>
            </article>
          </CardContent>
        </Card>
      )}

      {mode.kind === "edit" && current && (
        <Card>
          <CardHeader>
            <CardTitle>{t("edit")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("class_title_label")}</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{t("class_date_label")}</label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setMode({ kind: "view", id: current.id })}>
                <X className="size-4 mr-2" /> {t("close")}
              </Button>
              <Button onClick={saveEdit}>
                <Save className="size-4 mr-2" /> {t("save_changes")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode.kind === "list" && (
        <div>
          <h2 className="font-semibold text-lg mb-3">{t("saved_classes")}</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_classes_yet")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {rows.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <button
                      className="text-left flex-1 min-w-0"
                      onClick={() => setMode({ kind: "view", id: c.id })}
                    >
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.date}</p>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
