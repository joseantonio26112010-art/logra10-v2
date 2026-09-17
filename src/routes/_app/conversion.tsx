import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Loader2,
  X,
  FileDown,
  Sparkles,
  FileType2,
} from "lucide-react";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { extractTextFile } from "@/lib/logra/pdf";
import { convertNotesToQA } from "@/lib/logra/ai";
import { useI18n } from "@/lib/logra/i18n";

export const Route = createFileRoute("/_app/conversion")({
  head: () => ({ meta: [{ title: "Conversión — Logra10" }] }),
  component: ConversionPage,
});

type Picked =
  | { kind: "pdf"; file: File }
  | { kind: "image"; file: File; dataUrl: string };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

function isImage(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(file.name);
}
function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function ConversionPage() {
  const { t } = useI18n();
  const convert = convertNotesToQA;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [considerations, setConsiderations] = useState("");
  const [pairs, setPairs] = useState<{ question: string; answer: string }[]>([]);
  const [title, setTitle] = useState("Apuntes convertidos");
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const next: Picked[] = [];
    for (const f of Array.from(files)) {
      if (isImage(f)) {
        try {
          const dataUrl = await readAsDataUrl(f);
          next.push({ kind: "image", file: f, dataUrl });
        } catch {
          toast.error(`No se pudo leer ${f.name}`);
        }
      } else if (isPdf(f)) {
        next.push({ kind: "pdf", file: f });
      } else {
        toast.error(`Formato no soportado: ${f.name}`);
      }
    }
    setPicked((p) => [...p, ...next]);
  }

  function removeAt(i: number) {
    setPicked((p) => p.filter((_, idx) => idx !== i));
  }

  async function run() {
    if (picked.length === 0) {
      toast.error(t("conv_err_add_files"));
      return;
    }
    setLoading(true);
    setPairs([]);
    try {
      setProgress(t("reading_docs"));
      const texts: string[] = [];
      const images: string[] = [];
      for (const p of picked) {
        if (p.kind === "image") {
          images.push(p.dataUrl);
        } else {
          const text = await extractTextFile(p.file);
          if (text.trim()) texts.push(`# ${p.file.name}\n${text}`);
        }
      }
      const combined = texts.join("\n\n").slice(0, 380_000);
      setProgress(t("conv_ai_converting"));
      const res = await convert({
        data: {
          text: combined || undefined,
          images: images.length ? images : undefined,
          considerations: considerations.trim() || undefined,
        },
      });
      if (!res.pairs.length) throw new Error(t("conv_err_no_pairs"));
      setPairs(res.pairs);
      setTitle(res.title);
      toast.success(t("conv_done", { n: res.pairs.length }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("err_processing"));
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  function exportPDF() {
    if (!pairs.length) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxW = pageW - margin * 2;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(title, maxW);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 22 + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleDateString(), margin, y);
    y += 18;
    doc.setTextColor(0);

    pairs.forEach((p, i) => {
      const num = `${i + 1}. `;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const qLines = doc.splitTextToSize(num + p.question, maxW);
      if (y + qLines.length * 16 > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(qLines, margin, y);
      y += qLines.length * 16 + 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const aLines = doc.splitTextToSize(p.answer, maxW);
      // Break across pages if needed
      for (const line of aLines) {
        if (y + 14 > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 14;
      }
      y += 12;
    });

    doc.save(`${sanitize(title)}.pdf`);
  }

  async function exportDOCX() {
    if (!pairs.length) return;
    const children: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: title, bold: true })],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: new Date().toLocaleDateString(), italics: true, color: "808080" }),
        ],
      }),
      new Paragraph({ text: "" }),
    ];
    pairs.forEach((p, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${p.question}`, bold: true, size: 24 })],
          spacing: { before: 160, after: 80 },
        }),
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p.answer, size: 22 })],
          spacing: { after: 160 },
        }),
      );
    });
    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri" } } } },
      sections: [{ children }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${sanitize(title)}.docx`);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <section className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t("conv_heading")}
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">{t("conv_subtitle")}</p>
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
              <p className="font-medium">{t("conv_upload_cta")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("conv_upload_help")}</p>
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
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
                      {p.kind === "image" ? t("image_kind") : t("pdf_kind")} ·{" "}
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
              placeholder={t("conv_considerations_placeholder")}
              rows={3}
            />
          </div>

          <Button
            size="lg"
            disabled={loading || picked.length === 0}
            onClick={run}
            className="mt-2"
          >
            {loading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            {loading ? progress || t("processing") : t("conv_run_btn")}
          </Button>
        </CardContent>
      </Card>

      {pairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-muted-foreground text-sm">{t("conv_title_label")}:</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={exportPDF}>
                  <FileDown className="size-4 mr-2" /> {t("conv_export_pdf")}
                </Button>
                <Button onClick={exportDOCX}>
                  <FileType2 className="size-4 mr-2" /> {t("conv_export_docx")}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("conv_pairs_count", { n: pairs.length })}
            </p>
            <ol className="space-y-4">
              {pairs.map((p, i) => (
                <li key={i} className="rounded-lg border p-4 bg-card">
                  <p className="font-semibold">
                    {i + 1}. {p.question}
                  </p>
                  <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">
                    {p.answer}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function sanitize(s: string) {
  return s.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim() || "apuntes";
}
