import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Loader2,
  BookOpenCheck,
  ClipboardCheck,
  Trash2,
  X,
  HelpCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { extractTextFile } from "@/lib/logra/pdf";
import { Store, type Temario, type TemarioMeta, type QAPair, type SourceFile } from "@/lib/logra/storage";
import { extractQuestions } from "@/lib/logra/ai";
import { cropImageDataUrl } from "@/lib/logra/image";
import { useI18n } from "@/lib/logra/i18n";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Logra10 — Estudia con tus apuntes" },
      {
        name: "description",
        content:
          "Sube tus apuntes en PDF o imágenes y estudia con preguntas extraídas por IA, con corrección semántica inteligente.",
      },
    ],
  }),
  component: Home,
});

type Picked =
  | { kind: "pdf" | "text"; file: File }
  | { kind: "image"; file: File; dataUrl: string };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("No se pudo leer la imagen"));
    r.readAsDataURL(file);
  });
}

function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const extract = extractQuestions;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [temarios, setTemarios] = useState<TemarioMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [considerations, setConsiderations] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTemarios(Store.listTemarios());
    setActiveId(Store.getActiveId());
  }, []);

  async function addFiles(files: FileList | File[]) {
    const next: Picked[] = [];
    for (const f of Array.from(files)) {
      if (isImage(f)) {
        try {
          const dataUrl = await readAsDataUrl(f);
          next.push({ kind: "image", file: f, dataUrl });
        } catch {
          toast.error(`No se pudo leer la imagen ${f.name}`);
        }
      } else if (
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf")
      ) {
        next.push({ kind: "pdf", file: f });
      } else {
        next.push({ kind: "text", file: f });
      }
    }
    setPicked((p) => [...p, ...next]);
  }

  function removeAt(i: number) {
    setPicked((p) => p.filter((_, idx) => idx !== i));
  }

  async function process() {
    if (picked.length === 0) {
      toast.error(t("err_add_files"));
      return;
    }
    setLoading(true);
    try {
      setProgress(t("reading_docs"));
      const texts: string[] = [];
      const images: string[] = [];
      const sources: SourceFile[] = [];
      for (const p of picked) {
        if (p.kind === "image") {
          images.push(p.dataUrl);
          sources.push({ kind: "image", name: p.file.name, dataUrl: p.dataUrl });
        } else {
          const text = await extractTextFile(p.file);
          if (text.trim()) texts.push(`# ${p.file.name}\n${text}`);
          if (p.kind === "pdf") {
            try {
              const dataUrl = await readAsDataUrl(p.file);
              sources.push({ kind: "pdf", name: p.file.name, dataUrl });
            } catch {
              // sin previsualización si falla la lectura
            }
          }
        }
      }
      const combined = texts.join("\n\n").slice(0, 380_000);
      setProgress(t("ai_extracting"));
      const { pairs } = await extract({
        data: {
          text: combined || undefined,
          images: images.length ? images : undefined,
          considerations: considerations.trim() || undefined,
        },
      });
      if (!pairs.length) throw new Error(t("err_no_pairs"));

      setProgress(t("processing_graphics"));
      const finalPairs: QAPair[] = [];
      for (const p of pairs) {
        const out: QAPair = { question: p.question, answer: p.answer };
        if (
          p.is_graphic &&
          p.bbox &&
          typeof p.image_index === "number" &&
          images[p.image_index]
        ) {
          try {
            out.graphicDataUrl = await cropImageDataUrl(images[p.image_index], p.bbox);
          } catch {
            // si falla, queda como respuesta de texto
          }
        }
        finalPairs.push(out);
      }

      const name =
        picked.length === 1
          ? picked[0].file.name.replace(/\.[^.]+$/, "")
          : `Material (${new Date().toLocaleDateString()})`;
      const newT: Temario = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        pairs: finalPairs,
        sources,
      };
      await Store.saveTemario(newT);
      setTemarios(Store.listTemarios());
      setActiveId(newT.id);
      setPicked([]);
      toast.success(t("extracted_n_questions", { n: pairs.length }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("err_processing"));
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  const active = temarios.find((x) => x.id === activeId) ?? null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <section className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {t("home_title_a")} <span className="text-primary">{t("home_title_b")}</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t("home_subtitle")}
        </p>
      </section>

      <Card className="border-dashed border-2">
        <CardContent
          className="p-10 text-center flex flex-col items-center gap-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center gap-3 rounded-xl py-6 px-4 cursor-pointer hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <Upload className="size-6" />
            </div>
            <div>
              <p className="font-medium">{t("upload_cta")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("upload_help")}
              </p>
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {picked.length > 0 && (
            <ul className="w-full max-w-xl mt-2 space-y-2 text-left">
              {picked.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-card"
                >
                  {p.kind === "image" ? (
                    <img
                      src={p.dataUrl}
                      alt={p.file.name}
                      className="size-10 rounded object-cover border"
                    />
                  ) : (
                    <div className="size-10 rounded grid place-items-center bg-primary/10 text-primary">
                      <FileText className="size-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.kind === "image" ? t("image_kind") : p.kind === "pdf" ? t("pdf_kind") : t("text_kind")} ·{" "}
                      {(p.file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAt(i)}>
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="w-full max-w-xl text-left space-y-2 pt-2">
            <label className="text-sm font-medium">
              {t("considerations_label")}{" "}
              <span className="text-muted-foreground font-normal">{t("optional")}</span>
            </label>
            <Textarea
              value={considerations}
              onChange={(e) => setConsiderations(e.target.value)}
              placeholder={t("considerations_placeholder")}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t("considerations_help")}
            </p>
          </div>

          <Button
            size="lg"
            disabled={loading || picked.length === 0}
            onClick={process}
            className="mt-2"
          >
            {loading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            {loading ? progress || t("processing") : t("analyze_btn")}
          </Button>
        </CardContent>
      </Card>

      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{active.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {t("questions_count", { n: active.count ?? 0 })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="flex-1" onClick={() => navigate({ to: "/study" })}>
              <BookOpenCheck className="size-4 mr-2" /> {t("study_btn")}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={() => navigate({ to: "/exam" })}
            >
              <ClipboardCheck className="size-4 mr-2" /> {t("exam_btn")}
            </Button>
          </CardContent>
        </Card>
      )}

      {temarios.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-lg">{t("your_temarios")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {temarios.map((tm) => (
              <Card key={tm.id} className={tm.id === activeId ? "ring-2 ring-primary" : ""}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <button
                    className="text-left flex-1"
                    onClick={() => {
                      Store.setActive(tm.id);
                      setActiveId(tm.id);
                    }}
                  >
                    <p className="font-medium truncate">{tm.name}</p>
                    <p className="text-xs text-muted-foreground">{t("questions_count", { n: tm.count ?? 0 })}</p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await Store.deleteTemario(tm.id);
                      setTemarios(Store.listTemarios());
                      setActiveId(Store.getActiveId());
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Card className="mt-10 scroll-mt-24" id="faq">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="size-5 text-primary" />
            {t("faq_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="faq-1">
              <AccordionTrigger>{t("faq_q1")}</AccordionTrigger>
              <AccordionContent>{t("faq_a1")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2">
              <AccordionTrigger>{t("faq_q2")}</AccordionTrigger>
              <AccordionContent>{t("faq_a2")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-3">
              <AccordionTrigger>{t("faq_q3")}</AccordionTrigger>
              <AccordionContent>{t("faq_a3")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-4">
              <AccordionTrigger>{t("faq_q4")}</AccordionTrigger>
              <AccordionContent>{t("faq_a4")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-5">
              <AccordionTrigger>{t("faq_q5")}</AccordionTrigger>
              <AccordionContent>{t("faq_a5")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-6">
              <AccordionTrigger>{t("faq_q6")}</AccordionTrigger>
              <AccordionContent>{t("faq_a6")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-7">
              <AccordionTrigger>{t("faq_q7")}</AccordionTrigger>
              <AccordionContent>{t("faq_a7")}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

    </div>
  );
}
