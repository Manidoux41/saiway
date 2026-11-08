export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/icons/saiway-mark.svg" alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-xl shadow-sm" />
      <div className="leading-none">
        <div className="text-lg font-black tracking-[0.18em] text-[var(--color-primary-dark)]">
          {compact ? "SAIWAY" : "SAIWAY"}
        </div>
        {!compact && (
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-text)]/70">
            TRANSFER
          </div>
        )}
      </div>
    </div>
  );
}
import Image from "next/image";
