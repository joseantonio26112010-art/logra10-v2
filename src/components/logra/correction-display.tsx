import { useMemo } from "react";

export type Correction = {
  accuracy: number;
  coverage: number;
  correctness_summary: string;
  errors: Array<{ student_fragment: string; correct_value: string }>;
  missing: Array<{ fragment: string; reason: string }>;
};

export function PlainText({ text }: { text: string }) {
  return <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{text}</div>;
}

export function CircularStat({ value, label, color }: { value: number; label: string; color?: string }) {
  const safe = useMemo(() => Math.max(0, Math.min(100, Math.round(value))), [value]);
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (safe / 100) * c;
  const stroke = color ?? "var(--color-primary)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} stroke="var(--color-muted)" strokeWidth="8" fill="none" />
          <circle
            cx="48"
            cy="48"
            r={r}
            stroke={stroke}
            strokeWidth="8"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-semibold text-lg">{safe}%</div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
