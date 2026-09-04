import { cn } from "@/lib/utils";

type Props = { value: number; size?: number; className?: string };

function tone(value: number) {
  if (value >= 70) return "oklch(0.72 0.17 150)";
  if (value >= 45) return "oklch(0.78 0.16 80)";
  return "oklch(0.66 0.17 25)";
}

export function ScoreRing({ value, size = 34, className }: Props) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone(value);

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      title={`Score de oportunidade: ${value}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
