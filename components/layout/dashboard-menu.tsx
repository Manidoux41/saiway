"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";

export function DashboardSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <details id={id} className="group/disclosure min-w-0 scroll-mt-32 rounded-2xl border border-slate-200 bg-white">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 text-base font-bold text-[var(--color-primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2">
      <span className="min-w-0 break-words">{title}</span><ChevronDown size={20} aria-hidden="true" className="shrink-0 transition-transform group-open/disclosure:rotate-180" />
    </summary>
    <div className="min-w-0 border-t border-slate-100 p-2 sm:p-4">{children}</div>
  </details>;
}

export type DashboardMenuGroup = { title: string; items: { title: string; target: string }[] };

export function DashboardWorkspace({ menu, children }: { menu: ReactNode; children: ReactNode }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="mt-6 grid min-w-0 items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 xl:sticky xl:top-28 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={id} className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-bold text-[var(--color-primary)] xl:hidden">{t("dashboard.menu")}<ChevronDown size={20} aria-hidden="true" className={open ? "rotate-180" : ""} /></button>
      <div id={id} className={`${open ? "block" : "hidden"} xl:block`}>{menu}</div>
    </aside>
    <div className="min-w-0 space-y-4">{children}</div>
  </div>;
}

export function DashboardMenu({ groups }: { groups: DashboardMenuGroup[] }) {
  const { t } = useLanguage();
  return <nav aria-label={t("dashboard.menu")} className="my-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
    <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t("dashboard.menu")}</p>
    <div className="grid min-w-0 gap-2">
      {groups.map((group) => <details key={group.title} className="group/menu min-w-0 rounded-xl bg-slate-50">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-3 font-semibold text-[var(--color-primary-dark)]">
          <span className="min-w-0 break-words">{group.title}</span><ChevronDown size={18} aria-hidden="true" className="shrink-0 group-open/menu:rotate-180" />
        </summary>
        <ul className="space-y-1 px-2 pb-2">{group.items.map((item) => <li key={item.target}><a href={`#${item.target}`} onClick={(event) => {
          const target = document.getElementById(item.target);
          if (!target) return;
          event.preventDefault();
          for (let current: HTMLElement | null = target; current; current = current.parentElement) {
            if (current instanceof HTMLDetailsElement) current.open = true;
          }
          target.scrollIntoView({ block: "start", behavior: "instant" });
          const focus = target instanceof HTMLDetailsElement ? target.querySelector("summary") : target;
          if (focus instanceof HTMLElement) { if (focus.tagName !== "SUMMARY" && !focus.hasAttribute("tabindex")) focus.tabIndex = -1; focus.focus({ preventScroll: true }); }
        }} className="block min-h-11 rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-white focus-visible:outline-2">{item.title}</a></li>)}</ul>
      </details>)}
    </div>
  </nav>;
}
