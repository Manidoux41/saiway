export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-black text-white shadow-sm">
        <span className="relative">
          <span className="absolute left-[-0.18rem] top-[-0.25rem] h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--color-accent)]" />
          <span className="absolute right-[-0.24rem] bottom-[-0.15rem] h-2 w-2 rounded-full bg-white/90" />
          <span className="block h-3.5 w-3.5 rounded-full border-2 border-white/80" />
        </span>
      </div>
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
