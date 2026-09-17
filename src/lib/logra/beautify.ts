// Mejora puramente visual del texto de la respuesta: NO modifica ninguna
// palabra, solo añade saltos de línea para separar viñetas/numeraciones.
// Detecta marcadores comunes: "- ", "• ", "* ", "1.", "1)", "a)".

const BULLET_RE = /(?:^|\s)([-•*]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)/;

export function beautifyAnswer(text: string): string {
  if (!text) return text;
  // Normaliza espacios en blanco múltiples (no toca el contenido textual).
  let t = text.replace(/\r\n?/g, "\n").trim();

  // Inserta doble salto antes de cada viñeta (excepto la primera).
  const tokens: string[] = [];
  let lastIdx = 0;
  const re = /(^|\n|\s)([-•*]\s+|\d+[.)]\s+)/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(t)) !== null) {
    const at = m.index + m[1].length;
    if (count > 0) {
      tokens.push(t.slice(lastIdx, at).trimEnd());
      lastIdx = at;
    }
    count++;
  }
  tokens.push(t.slice(lastIdx));
  if (tokens.length <= 1) return t;
  return tokens.map((s) => s.trim()).filter(Boolean).join("\n\n");
}

// Para validar que el contenido no cambia (mismas palabras), se puede
// comparar normalizando espacios.
export function sameWords(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

// Mantiene compatibilidad con BULLET_RE si se necesita en otro sitio.
export const _BULLET_RE = BULLET_RE;
