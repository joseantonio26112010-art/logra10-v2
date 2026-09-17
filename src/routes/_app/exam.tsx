import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Store, type Temario } from "@/lib/logra/storage";
import { correctAnswer } from "@/lib/logra/ai";
import { CircularStat } from "@/components/logra/correction-display";

type Result = { question: string; original: string; student: string; accuracy: number; coverage: number };

export const Route = createFileRoute("/_app/exam")({
  head: () => ({ meta: [{ title: "Examen — Logra10" }] }),
  component: ExamPage,
});

function ExamPage() {
  const navigate = useNavigate();
  const correctFn = correctAnswer;
  const [temario, setTemario] = useState<Temario | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Store.getActive().then(setTemario).catch(() => setTemario(null));
  }, []);

  const total = temario?.pairs.length ?? 0;
  const current = useMemo(() => temario?.pairs[idx], [temario, idx]);

  async function submit() {
    if (!current) return;
    if (!answer.trim()) {
      toast.error("Escribe tu respuesta");
      return;
    }
    setLoading(true);
    try {
      const c = await correctFn({
        data: { question: current.question, original: current.answer, student: answer },
      });
      const r: Result = {
        question: current.question,
        original: current.answer,
        student: answer,
        accuracy: c.accuracy,
        coverage: c.coverage,
      };
      const next = [...results, r];
      setResults(next);
      setAnswer("");
      if (idx + 1 >= total) {
        setDone(true);
      } else {
        setIdx(idx + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error corrigiendo");
    } finally {
      setLoading(false);
    }
  }

  if (!temario) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-2xl font-semibold">No hay temario activo</h2>
        <Button onClick={() => navigate({ to: "/" })}>Volver al inicio</Button>
      </div>
    );
  }

  if (done) {
    const avgAcc = results.reduce((a, r) => a + r.accuracy, 0) / Math.max(1, results.length);
    const avgCov = results.reduce((a, r) => a + r.coverage, 0) / Math.max(1, results.length);
    const global = (avgAcc * 0.6 + avgCov * 0.4) / 10;
    const sorted = [...results].sort((a, b) => a.accuracy - b.accuracy);
    const weakest = sorted.slice(0, 3);
    const best = [...sorted].reverse().slice(0, 3);
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Resultados del examen</h1>
          <p className="text-muted-foreground">{temario.name} · {total} preguntas</p>
        </div>
        <Card>
          <CardContent className="p-6 flex flex-wrap items-center justify-around gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">{global.toFixed(1)}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">Nota global / 10</div>
            </div>
            <CircularStat value={avgAcc} label="Acierto medio" />
            <CircularStat value={avgCov} label="Cobertura media" color="oklch(0.62 0.17 150)" />
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <ResultsList title="Mejor dominadas" items={best} tone="success" />
          <ResultsList title="Preguntas más débiles" items={weakest} tone="destructive" />
        </div>

        <div className="flex justify-center gap-3">
          <Button onClick={() => navigate({ to: "/" })}>Volver al menú</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Modo examen · {temario.name}</span>
        <span>Pregunta {idx + 1} de {total}</span>
      </div>
      <Progress value={(idx / total) * 100} />
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-semibold whitespace-pre-wrap">{current!.question}</h2>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Tu respuesta…"
            className="min-h-40 text-base"
            disabled={loading}
          />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ArrowRight className="size-4 mr-2" />}
              {idx + 1 === total ? "Finalizar examen" : "Siguiente"}
            </Button>
            <Button variant="ghost" className="ml-auto" onClick={() => navigate({ to: "/" })}>
              <LogOut className="size-4 mr-2" /> Salir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsList({ title, items, tone }: { title: string; items: Result[]; tone: "success" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h3 className="font-semibold">{title}</h3>
        <ul className="space-y-2 text-sm">
          {items.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 flex-1">{r.question}</span>
              <span className={tone === "success" ? "text-success font-medium" : "text-destructive font-medium"}>
                {Math.round(r.accuracy)}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
