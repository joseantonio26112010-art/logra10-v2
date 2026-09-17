import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, FileText, Image as ImageIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SourceFile } from "@/lib/logra/storage";

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const [, b64] = dataUrl.split(",");
  if (!b64) return null;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function PdfCanvas({
  dataUrl,
  name,
  zoom,
  pageNumber,
  onPageCount,
}: {
  dataUrl: string;
  name: string;
  zoom: number;
  pageNumber: number;
  onPageCount: (count: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { promise: Promise<any>; destroy: () => void } | undefined;

    async function render() {
      setError(null);
      setRendering(true);
      const bytes = dataUrlToBytes(dataUrl);
      if (!bytes) {
        setError("No se pudo leer el PDF guardado.");
        setRendering(false);
        return;
      }

      try {
        const pdfjs = await import("pdfjs-dist");
        (pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        loadingTask = pdfjs.getDocument({ data: bytes.slice().buffer });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        onPageCount(doc.numPages);
        const safePage = Math.min(Math.max(pageNumber, 1), doc.numPages);
        const page = await doc.getPage(safePage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        if (!cancelled) setError("No se pudo previsualizar el PDF en este navegador.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    render();
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [dataUrl, onPageCount, pageNumber, zoom]);

  if (error) {
    return <div className="w-full h-full grid place-items-center text-sm text-muted-foreground p-6 text-center">{error}</div>;
  }

  return (
    <div className="w-full h-full overflow-auto p-4">
      <div className="min-h-full grid place-items-center">
        <div className="relative rounded-md border bg-card shadow-sm overflow-hidden">
          {rendering && (
            <div className="absolute inset-0 grid place-items-center bg-background/70 text-sm text-muted-foreground z-10">
              Cargando página…
            </div>
          )}
          <canvas ref={canvasRef} aria-label={name} className="block max-w-none" />
        </div>
      </div>
    </div>
  );
}

export function SourceViewer({
  open,
  onOpenChange,
  sources,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sources: SourceFile[];
}) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setIdx(0);
      setZoom(1);
    }
  }, [open]);

  useEffect(() => {
    setZoom(1);
    setPdfPage(1);
    setPdfPageCount(0);
    if (scrollRef.current) scrollRef.current.scrollTo({ top: 0, left: 0 });
  }, [idx]);

  const current = sources[Math.min(idx, sources.length - 1)];

  if (!sources.length || !current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 py-3 pr-14 border-b flex-row items-center gap-3 space-y-0">
          <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            {current.kind === "pdf" ? <FileText className="size-4" /> : <ImageIcon className="size-4" />}
          </div>
          <DialogTitle className="text-sm font-medium truncate flex-1 text-left">
            {current.name}
          </DialogTitle>
          {sources.length > 1 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="tabular-nums w-12 text-center">
                {idx + 1} / {sources.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIdx((i) => Math.min(sources.length - 1, i + 1))}
                disabled={idx >= sources.length - 1}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          {current.kind === "pdf" && pdfPageCount > 1 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                disabled={pdfPage <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="tabular-nums w-12 text-center">
                {pdfPage} / {pdfPageCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setPdfPage((p) => Math.min(pdfPageCount, p + 1))}
                disabled={pdfPage >= pdfPageCount}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          {(current.kind === "image" || current.kind === "pdf") && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                <ZoomOut className="size-4" />
              </Button>
              <span className="text-xs tabular-nums w-12 text-center text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setZoom((z) => Math.min(6, z + 0.25))}>
                <ZoomIn className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setZoom(1)}>
                <RotateCcw className="size-4" />
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/30">
          {current.kind === "pdf" ? (
            <PdfCanvas
              dataUrl={current.dataUrl}
              name={current.name}
              zoom={zoom}
              pageNumber={pdfPage}
              onPageCount={setPdfPageCount}
            />
          ) : (
            <div
              ref={scrollRef}
              className="w-full h-full overflow-auto grid place-items-center p-4"
            >
              <img
                src={current.dataUrl}
                alt={current.name}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  transition: "transform 150ms ease",
                }}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
