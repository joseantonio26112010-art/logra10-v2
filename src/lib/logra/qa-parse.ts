// Extracción determinista de pares pregunta/respuesta a partir de texto.
// Funciona sin conexión y sin modelo: reconoce el formato
// "número - pregunta - respuesta" y las preguntas terminadas en "?".

export type ParsedPair = { question: string; answer: string };

const NUMBERED = /^\s*(\d{1,3})\s*[.)\-–:]\s*(.+)$/;

function isQuestionLine(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  if (l.endsWith("?")) return true;
  if (NUMBERED.test(l)) return true;
  if (/^(¿|qué|que|cómo|como|cuál|cual|cuándo|cuando|dónde|donde|por qué|porque|quién|quien|define|explica|enumera|cita|indica|nombra|describe)\b/i.test(l))
    return l.length < 200;
  return false;
}

function clean(line: string): string {
  const m = line.match(NUMBERED);
  return (m ? m[2] : line).trim();
}

export function parseQAFromText(raw: string): ParsedPair[] {
  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .filter((l) => l.trim().length > 0);

  const pairs: ParsedPair[] = [];
  let current: { question: string; answer: string[] } | null = null;

  for (const line of lines) {
    if (isQuestionLine(line)) {
      if (current && current.answer.join(" ").trim()) {
        pairs.push({ question: current.question, answer: current.answer.join("\n").trim() });
      }
      current = { question: clean(line), answer: [] };
    } else if (current) {
      current.answer.push(line.trim());
    }
  }
  if (current && current.answer.join(" ").trim()) {
    pairs.push({ question: current.question, answer: current.answer.join("\n").trim() });
  }

  return pairs.filter((p) => p.question.length > 2 && p.answer.length > 1);
}

const STOP = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","al","a","en","y","o","que","se","es","son","con","por","para","su","sus","lo","como","más","mas","este","esta","estos","estas","the","of","and","to","in","is","are",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9áéíóúñ\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Cobertura y exactitud aproximadas comparando conjuntos de términos. */
export function heuristicScore(original: string, student: string) {
  const o = tokenize(original);
  const s = new Set(tokenize(student));
  const oSet = new Set(o);
  const covered = [...oSet].filter((w) => s.has(w));
  const missing = [...oSet].filter((w) => !s.has(w));
  const coverage = oSet.size ? Math.round((covered.length / oSet.size) * 100) : 0;
  const extra = [...s].filter((w) => !oSet.has(w));
  const accuracy = s.size ? Math.round(((s.size - extra.length * 0.5) / s.size) * 100) : 0;
  return {
    coverage,
    accuracy: Math.max(0, Math.min(100, accuracy)),
    missingTerms: missing.slice(0, 8),
  };
}
