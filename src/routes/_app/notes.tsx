import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, type NoteRow } from "@/lib/logra/storage";

export const Route = createFileRoute("/_app/notes")({
  head: () => ({ meta: [{ title: "Notas — Logra10" }] }),
  component: NotesPage,
});

function NotesPage() {
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<string>("");
  const [result, setResult] = useState<{ subject: string; values: number[]; mean: number } | null>(null);

  useEffect(() => {
    Store.hydrateNotes().then((rows) => {
      setRows(rows);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    Store.saveNotes(rows);
  }, [rows, loaded]);

  // Save on unmount and on tab close to guarantee persistence
  useEffect(() => {
    const handler = () => {
      if (loaded) Store.saveNotes(rows);
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
      if (loaded) Store.saveNotes(rows);
    };
  }, [rows, loaded]);

  const subjects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.subject.trim()).filter(Boolean))).sort(),
    [rows],
  );

  function addRow() {
    setRows((r) => [
      ...r,
      {
        id: crypto.randomUUID(),
        subject: "",
        content: "",
        date: new Date().toISOString().slice(0, 10),
        grade: "",
      },
    ]);
  }
  function updateRow(id: string, patch: Partial<NoteRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  function calculate() {
    if (!subject) return;
    const values = rows
      .filter((r) => r.subject.trim().toLowerCase() === subject.toLowerCase())
      .map((r) => parseFloat(r.grade.replace(",", ".")))
      .filter((n) => Number.isFinite(n));
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    setResult({ subject, values, mean });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notas</h1>
          <p className="text-muted-foreground text-sm">Gestiona tus calificaciones académicas.</p>
        </div>
        <Button onClick={addRow}><Plus className="size-4 mr-2" /> Añadir fila</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <Th>Asignatura</Th>
                <Th>Contenido</Th>
                <Th className="w-40">Fecha</Th>
                <Th className="w-28">Calificación</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No hay notas aún. Pulsa "Añadir fila".</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/30">
                  <Td><EditableInput value={row.subject} onChange={(v) => updateRow(row.id, { subject: v })} placeholder="Matemáticas" /></Td>
                  <Td><EditableInput value={row.content} onChange={(v) => updateRow(row.id, { content: v })} placeholder="Examen tema 3" /></Td>
                  <Td><EditableInput type="date" value={row.date} onChange={(v) => updateRow(row.id, { date: v })} /></Td>
                  <Td><EditableInput value={row.grade} onChange={(v) => updateRow(row.id, { grade: v })} placeholder="8.5" /></Td>
                  <Td>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-2">
        <Button size="lg" onClick={() => { setSubject(subjects[0] ?? ""); setResult(null); setOpen(true); }} disabled={subjects.length === 0}>
          <Calculator className="size-4 mr-2" /> CALCULAR
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿De qué asignatura deseas calcular la media?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Selecciona una asignatura" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {result && (
              <Card className="bg-muted/40">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Asignatura: <strong className="text-foreground">{result.subject}</strong></p>
                  <p className="text-sm text-muted-foreground">Notas usadas: <strong className="text-foreground">{result.values.length}</strong> ({result.values.join(", ") || "—"})</p>
                  <p className="text-3xl font-bold text-primary">{result.mean.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Media aritmética sobre las calificaciones numéricas.</p>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cerrar</Button>
            <Button onClick={calculate} disabled={!subject}><Calculator className="size-4 mr-2" /> Calcular media</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-2 py-1.5 align-middle">{children}</td>;
}
function EditableInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-9"
    />
  );
}
