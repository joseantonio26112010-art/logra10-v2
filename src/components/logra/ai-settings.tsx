import { useEffect, useState } from "react";
import { Cloud, Cpu, Download, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/logra/i18n";
import {
  MODELS,
  getAISettings,
  setAISettings,
  type AISettings,
  type Engine,
  type Tier,
} from "@/lib/logra/settings";
import { resetLocalAI, warmupLocalAI, type ProgressEvent } from "@/lib/logra/local-ai";

const COPY = {
  es: {
    title: "Ajustes de IA",
    desc: "Logra10 funciona sin conexión: los modelos se ejecutan en tu dispositivo y tus apuntes nunca salen de él.",
    engine: "Motor",
    local: "En mi dispositivo",
    localDesc: "Privado y sin internet. Requiere descargar el modelo una vez.",
    cloud: "En la nube",
    cloudDesc: "Más preciso y admite fotos de apuntes. Necesita conexión.",
    model: "Modelo local",
    light: "Ligero",
    lightDesc: "Rápido, respuestas más simples.",
    balanced: "Equilibrado",
    balancedDesc: "Mejor calidad, descarga más larga.",
    download: "Descargar modelo ahora",
    downloading: "Descargando…",
    ready: "Modelo listo para usarse sin conexión",
    failed: "No se pudo preparar el modelo",
    open: "Ajustes de IA",
  },
  en: {
    title: "AI settings",
    desc: "Logra10 works offline: models run on your device and your notes never leave it.",
    engine: "Engine",
    local: "On my device",
    localDesc: "Private and offline. The model downloads once.",
    cloud: "In the cloud",
    cloudDesc: "More accurate and reads photos of notes. Needs a connection.",
    model: "Local model",
    light: "Light",
    lightDesc: "Fast, simpler answers.",
    balanced: "Balanced",
    balancedDesc: "Better quality, longer download.",
    download: "Download model now",
    downloading: "Downloading…",
    ready: "Model ready to use offline",
    failed: "The model could not be prepared",
    open: "AI settings",
  },
};

export function AISettingsDialog() {
  const { lang } = useI18n();
  const c = COPY[lang === "en" ? "en" : "es"];
  const [open, setOpen] = useState(false);
  const [settings, setLocalSettings] = useState<AISettings>({ engine: "local", tier: "light" });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    setLocalSettings(getAISettings());
  }, []);

  function update(next: Partial<AISettings>) {
    setAISettings(next);
    setLocalSettings(getAISettings());
    if (next.tier) resetLocalAI();
  }

  async function download() {
    setBusy(true);
    setProgress(null);
    try {
      await warmupLocalAI((p) => setProgress(p));
      toast.success(c.ready);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : c.failed);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={c.open} title={c.open}>
          <Settings2 className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.desc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <p className="text-sm font-medium">{c.engine}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Option
                active={settings.engine === "local"}
                icon={<Cpu className="size-4" />}
                title={c.local}
                desc={c.localDesc}
                onClick={() => update({ engine: "local" as Engine })}
              />
              <Option
                active={settings.engine === "cloud"}
                icon={<Cloud className="size-4" />}
                title={c.cloud}
                desc={c.cloudDesc}
                onClick={() => update({ engine: "cloud" as Engine })}
              />
            </div>
          </section>

          {settings.engine === "local" && (
            <section className="space-y-2 animate-in fade-in-50">
              <p className="text-sm font-medium">{c.model}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Option
                  active={settings.tier === "light"}
                  title={`${c.light} · ${MODELS.light.size}`}
                  desc={c.lightDesc}
                  onClick={() => update({ tier: "light" as Tier })}
                />
                <Option
                  active={settings.tier === "balanced"}
                  title={`${c.balanced} · ${MODELS.balanced.size}`}
                  desc={c.balancedDesc}
                  onClick={() => update({ tier: "balanced" as Tier })}
                />
              </div>
              <Button onClick={download} disabled={busy} className="w-full mt-2">
                <Download className="size-4" />
                {busy ? c.downloading : c.download}
              </Button>
              {busy && progress && (
                <p className="text-xs text-muted-foreground truncate">
                  {progress.status} {progress.file}
                  {typeof progress.percent === "number" ? ` · ${progress.percent}%` : ""}
                </p>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Option({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon?: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition hover:bg-secondary ${
        active ? "border-primary bg-secondary" : "border-border"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="block text-xs text-muted-foreground mt-1">{desc}</span>
    </button>
  );
}
