// Persistencia local de Logra10.
//
// Estrategia:
// - Metadata ligera de temarios (id, nombre, createdAt, count) y notas
//   en localStorage para arranque rápido y sin async.
// - Datos pesados (pairs con imágenes gráficas base64, y sources) en
//   IndexedDB para evitar el límite de cuota (~5 MB) de localStorage.
// - Se escribe en AMBOS sitios para máxima resiliencia: si IDB falla,
//   localStorage hace de respaldo de notas y metadata, y viceversa para
//   las notas (también se replican en IDB).
export type QAPair = {
  question: string;
  answer: string;
  /** Imagen recortada (data URL) con la respuesta gráfica, si la hay. */
  graphicDataUrl?: string;
};

export type SourceFile = {
  kind: "pdf" | "image";
  name: string;
  /** data URL del fichero original cargado, para previsualización posterior. */
  dataUrl: string;
};

/**
 * Temario "ligero" expuesto por `listTemarios`. Los pares se cargan bajo
 * demanda con `getTemario(id)` para no inflar el listado en memoria.
 */
export type TemarioMeta = {
  id: string;
  name: string;
  createdAt: number;
  /** Nº de pares; útil para mostrar en el listado sin cargar todo. */
  count?: number;
};

export type Temario = TemarioMeta & {
  pairs: QAPair[];
  sources?: SourceFile[];
};

export type NoteRow = {
  id: string;
  subject: string;
  content: string;
  date: string; // YYYY-MM-DD
  grade: string;
};

const TEMARIO_INDEX_KEY = "logra10:temarios"; // ahora guarda metadata únicamente
const ACTIVE_KEY = "logra10:active-temario";
const NOTES_KEY = "logra10:notes";

const DB_NAME = "logra10";
const DB_VERSION = 2;
const SOURCES_STORE = "sources";
const PAIRS_STORE = "pairs";
const KV_STORE = "kv"; // para notas (respaldo) y otros

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeWrite(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SOURCES_STORE)) db.createObjectStore(SOURCES_STORE);
      if (!db.objectStoreNames.contains(PAIRS_STORE)) db.createObjectStore(PAIRS_STORE);
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(store: string, key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function toMeta(t: Temario): TemarioMeta {
  return { id: t.id, name: t.name, createdAt: t.createdAt, count: t.pairs.length };
}

export const Store = {
  /** Lista ligera de temarios (sin pares ni sources). */
  listTemarios: (): TemarioMeta[] => safeRead<TemarioMeta[]>(TEMARIO_INDEX_KEY, []),

  /** Carga el temario completo desde IndexedDB. */
  async getTemario(id: string): Promise<Temario | null> {
    const meta = Store.listTemarios().find((x) => x.id === id);
    if (!meta) return null;
    const pairs = (await idbGet<QAPair[]>(PAIRS_STORE, id)) ?? [];
    return { ...meta, pairs };
  },

  /**
   * Guarda el temario. Los pares y los sources van a IndexedDB; solo la
   * metadata ligera se persiste en localStorage. Las imágenes gráficas
   * pueden ser muy grandes y excederían la cuota si fueran a localStorage.
   */
  async saveTemario(t: Temario): Promise<void> {
    // 1) pares -> IDB
    try {
      await idbSet(PAIRS_STORE, t.id, t.pairs);
    } catch {
      throw new Error(
        "No se pudo guardar el temario en el almacenamiento del navegador. Libera espacio e inténtalo de nuevo.",
      );
    }
    // 2) metadata -> localStorage
    const all = Store.listTemarios().filter((x) => x.id !== t.id);
    all.unshift(toMeta(t));
    safeWrite(TEMARIO_INDEX_KEY, all);
    Store.setActive(t.id);
    // 3) sources -> IDB (opcional, no bloquea)
    if (t.sources && t.sources.length) {
      try {
        await idbSet(SOURCES_STORE, `sources:${t.id}`, t.sources);
      } catch {
        // sin previsualización si falla
      }
    }
  },

  async deleteTemario(id: string): Promise<void> {
    safeWrite(TEMARIO_INDEX_KEY, Store.listTemarios().filter((x) => x.id !== id));
    if (Store.getActiveId() === id) safeWrite(ACTIVE_KEY, null);
    try { await idbDel(PAIRS_STORE, id); } catch { /* ignorar */ }
    try { await idbDel(SOURCES_STORE, `sources:${id}`); } catch { /* ignorar */ }
  },

  getActiveId: (): string | null => safeRead<string | null>(ACTIVE_KEY, null),
  setActive(id: string | null) { safeWrite(ACTIVE_KEY, id); },

  /** Devuelve la metadata del temario activo (sin pares). */
  getActiveMeta(): TemarioMeta | null {
    const id = Store.getActiveId();
    if (!id) return null;
    return Store.listTemarios().find((x) => x.id === id) ?? null;
  },

  /** Carga el temario activo completo (con pares) desde IDB. */
  async getActive(): Promise<Temario | null> {
    const id = Store.getActiveId();
    if (!id) return null;
    return Store.getTemario(id);
  },

  /** Carga los archivos originales (sources) de un temario desde IndexedDB. */
  async getSources(id: string): Promise<SourceFile[]> {
    try {
      const v = await idbGet<SourceFile[]>(SOURCES_STORE, `sources:${id}`);
      return v ?? [];
    } catch {
      return [];
    }
  },

  // ===== Notas =====
  listNotes: (): NoteRow[] => safeRead<NoteRow[]>(NOTES_KEY, []),
  /**
   * Guarda notas en localStorage y replica en IDB como respaldo.
   * Si localStorage está lleno, IDB sigue funcionando.
   */
  saveNotes(rows: NoteRow[]) {
    safeWrite(NOTES_KEY, rows);
    // Respaldo en IDB (best-effort, no bloqueante)
    idbSet(KV_STORE, "notes", rows).catch(() => {});
  },
  /** Restaura notas desde IDB si localStorage está vacío. */
  async hydrateNotes(): Promise<NoteRow[]> {
    const ls = Store.listNotes();
    if (ls.length) return ls;
    try {
      const backup = await idbGet<NoteRow[]>(KV_STORE, "notes");
      if (backup && backup.length) {
        safeWrite(NOTES_KEY, backup);
        return backup;
      }
    } catch { /* ignorar */ }
    return [];
  },

  // ===== Clases (resúmenes de transcripciones) =====
  listClasses: (): ClassSummary[] => safeRead<ClassSummary[]>(CLASSES_KEY, []),
  saveClasses(rows: ClassSummary[]) {
    safeWrite(CLASSES_KEY, rows);
    idbSet(KV_STORE, "classes", rows).catch(() => {});
  },
  async hydrateClasses(): Promise<ClassSummary[]> {
    const ls = Store.listClasses();
    if (ls.length) return ls;
    try {
      const backup = await idbGet<ClassSummary[]>(KV_STORE, "classes");
      if (backup && backup.length) {
        safeWrite(CLASSES_KEY, backup);
        return backup;
      }
    } catch { /* ignorar */ }
    return [];
  },
};

export type ClassSummary = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string; // markdown
  createdAt: number;
};

const CLASSES_KEY = "logra10:classes";
