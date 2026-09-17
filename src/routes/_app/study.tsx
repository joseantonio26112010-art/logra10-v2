import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Eye,
  Loader2,
  RefreshCw,
  SquareCheck,
  LogOut,
  FileSearch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Store, type Temario, type SourceFile } from "@/lib/logra/storage";
import { correctAnswer } from "@/lib/logra/ai";
import { beautifyAnswer } from "@/lib/logra/beautify";
import {
  CircularStat,
  PlainText,
  type Correction,
} from "@/components/logra/correction-display";
import { SourceViewer } from "@/components/logra/source-viewer";

export const Route = createFileRoute("/_app/study")({
  head: () => ({ meta: [{ title: "Estudiar — Logra10" }] }),
  component: StudyPage,
});

function StudyPage() {
  const navigate = useNavigate();
  const correctFn = correctAnswer;
  const [temario, setTemario] = useState<Temario | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const [sources, setSources] = useState<SourceFile[]>([]);

  useEffect(() => {
    Store.getActive()
      .then((t) => {
        setTemario(t);
        if (t) Store.getSources(t.id).then(setSources).catch(() => setSources([]));
      })
      .catch(() => setTemario(null));
  }, []);

  const total = temario?.pairs.length ?? 0;
  const current = useMemo(() => temario?.pairs[idx], [temario, idx]);
  const finished = temario && idx >= total;

  function reset() {
    setAnswer("");
    setShowAnswer(false);
    setCorrection(null);
  }
  function next() {
    setIdx((i) => i + 1);
    reset();
  }
  function repeat() {
    reset();
  }

  async function handleCorrect() {
    if (!current || !answer.trim()) {
      toast.error("Escribe tu respuesta primero");
      return;
    }
    setLoading(true);
    try {
      const c = await correctFn({
        data: { question: current.question, original: current.answer, student: answer },
      });
      setCorrection(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en la corrección");
    } finally {
      setLoading(false);
    }
  }

  if (!temario) {
    return (
      <EmptyState
        title="No hay temario activo"
        action={() => navigate({ to: "/" })}
        actionLabel="Volver al inicio"
      />
    );
  }

  if (finished) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
        <h1 className="text-3xl font-bold">¡Has completado el temario! 🎉</h1>
        <p className="text-muted-foreground">{temario.name} · {total} preguntas</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => { setIdx(0); reset(); }}>
            <RefreshCw className="size-4 mr-2" /> Repasar de nuevo
          </Button>
          <Button variant="secondary" onClick={() => navigate({ to: "/" })}>
            Volver al menú principal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{temario.name}</span>
        <span>Pregunta {idx + 1} de {total}</span>
      </div>
      <Progress value={((idx) / total) * 100} />

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-semibold leading-snug whitespace-pre-wrap">{current!.question}</h2>

          {!correction && (
            <>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Escribe tu respuesta…"
                className="min-h-40 text-base"
                disabled={loading}
              />
              {showAnswer && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Respuesta original</p>
                  {current!.graphicDataUrl && (
                    <img
                      src={current!.graphicDataUrl}
                      alt="Respuesta gráfica del temario"
                      className="rounded-md border max-h-[420px] w-auto mx-auto"
                    />
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{beautifyAnswer(current!.answer)}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleCorrect} disabled={loading}>
                  {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <SquareCheck className="size-4 mr-2" />}
                  Corregir
                </Button>
                <Button variant="secondary" onClick={() => setShowAnswer((s) => !s)} disabled={loading}>
                  <Eye className="size-4 mr-2" /> {showAnswer ? "Ocultar" : "Mostrar"} respuesta
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setViewerOpen(true)}
                  disabled={sources.length === 0}
                  title={sources.length === 0 ? "No hay apuntes originales guardados" : "Abrir apuntes originales"}
                >
                  <FileSearch className="size-4 mr-2" /> Consultar apuntes cargados
                </Button>
                <Button variant="ghost" onClick={next}>
                  Siguiente <ArrowRight className="size-4 ml-2" />
                </Button>
                <Button variant="ghost" className="ml-auto" onClick={() => navigate({ to: "/" })}>
                  <LogOut className="size-4 mr-2" /> Salir
                </Button>
              </div>
            </>
          )}

          {correction && (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-2 rounded-full bg-primary" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tu respuesta
                    </p>
                  </div>
                  <PlainText text={answer} />
                </div>
                <div className="rounded-xl border bg-accent/30 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Respuesta original
                    </p>
                  </div>
                  {current!.graphicDataUrl && (
                    <img
                      src={current!.graphicDataUrl}
                      alt="Respuesta gráfica del temario"
                      className="rounded-md border max-h-72 w-auto mb-3"
                    />
                  )}
                  <PlainText text={beautifyAnswer(current!.answer)} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 justify-center py-2">
                <CircularStat value={correction.accuracy} label="Acierto factual" />
                <CircularStat value={correction.coverage} label="Cobertura" color="oklch(0.62 0.17 150)" />
              </div>

              <p className="text-sm leading-relaxed bg-accent/40 border rounded-lg p-3">
                {correction.correctness_summary}
              </p>

              {correction.errors.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Errores detectados</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {correction.errors.map((e, i) => (
                      <li key={i}>
                        <span className="font-medium text-foreground">{e.student_fragment}</span> → correcto: <strong>{e.correct_value}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {correction.missing.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Información que falta</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {correction.missing.map((m, i) => (
                      <li key={i}>
                        <span className="font-medium text-foreground">{m.fragment}</span>
                        {m.reason ? ` — ${m.reason}` : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={next}>
                  Siguiente <ArrowRight className="size-4 ml-2" />
                </Button>
                <Button variant="secondary" onClick={repeat}>
                  <RefreshCw className="size-4 mr-2" /> Repetir pregunta
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setViewerOpen(true)}
                  disabled={sources.length === 0}
                >
                  <FileSearch className="size-4 mr-2" /> Consultar apuntes cargados
                </Button>
                <Button variant="ghost" className="ml-auto" onClick={() => navigate({ to: "/" })}>
                  <LogOut className="size-4 mr-2" /> Salir
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SourceViewer open={viewerOpen} onOpenChange={setViewerOpen} sources={sources} />
    </div>
  );
}

function EmptyState({ title, action, actionLabel }: { title: string; action: () => void; actionLabel: string }) {
  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">Sube un PDF en la pantalla de inicio para empezar.</p>
      <Button onClick={action}>{actionLabel}</Button>
    </div>
  );
}
