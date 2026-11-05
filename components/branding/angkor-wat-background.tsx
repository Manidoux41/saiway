import { angkorWatPaths } from "@/lib/business-card-art";

export function AngkorWatBackground({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 320 170" aria-hidden="true" focusable="false">
    <circle cx="252" cy="54" r="42" fill="#dfb56b" opacity="0.32" />
    <g fill="#032ea1" opacity="0.16">{angkorWatPaths.map((d) => <path key={d} d={d} />)}</g>
    <path d="M0 161 Q80 153 160 161 T320 161" fill="none" stroke="#dfb56b" strokeWidth="3" opacity="0.5" />
  </svg>;
}
