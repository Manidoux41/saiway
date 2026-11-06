"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { searchPlaces } from "@/lib/place-search";
import { z } from "zod";

const destinations = [
  { name: "Angkor Aurora Hotel", detail: "Wat Bo Road, Siem Reap", kind: "Hotel" },
  { name: "Angkor Elysium Suite", detail: "National Road 6, Siem Reap", kind: "Hotel" },
  { name: "Borei Angkor Resort & Spa", detail: "National Road 6, Siem Reap", kind: "Hotel" },
  { name: "Golden Temple Boutique", detail: "Sok San Road, Siem Reap", kind: "Hotel" },
  { name: "Heritage Suites Hotel", detail: "Wat Polanka, Siem Reap", kind: "Hotel" },
  { name: "Jaya House River Park", detail: "River Road, Siem Reap", kind: "Hotel" },
  { name: "Le Meridien Angkor", detail: "Charles de Gaulle Boulevard, Siem Reap", kind: "Hotel" },
  { name: "Park Hyatt Siem Reap", detail: "Sivutha Boulevard, Siem Reap", kind: "Hotel" },
  { name: "Raffles Grand Hotel d'Angkor", detail: "Charles de Gaulle Boulevard, Siem Reap", kind: "Hotel" },
  { name: "Shinta Mani Angkor", detail: "Oum Khun Street, Siem Reap", kind: "Hotel" },
  { name: "Sokha Siem Reap Resort", detail: "National Road 6, Siem Reap", kind: "Hotel" },
  { name: "Zannier Hotels Phum Baitang", detail: "Sangkat Sambuor, Siem Reap", kind: "Hotel" },
  { name: "Babel Guesthouse", detail: "Rambutan Lane, Wat Damnak, Siem Reap", kind: "Guesthouse" },
  { name: "The Siem Reap Chilled Backpacker", detail: "Funky Lane, Siem Reap", kind: "Guesthouse" },
  { name: "One Stop Hostel Siem Reap", detail: "Street 9, Old Market, Siem Reap", kind: "Guesthouse" },
  { name: "Motherhome Guesthouse", detail: "Wat Bo Road, Siem Reap", kind: "Guesthouse" },
  { name: "The Place Hostel & Pool Bar", detail: "Bakheng Road, Siem Reap", kind: "Guesthouse" },
  { name: "The Little Red Fox Espresso", detail: "Sivutha Boulevard, Siem Reap", kind: "Guesthouse" },
  { name: "Pub Street", detail: "Street 8, Old Market, Siem Reap", kind: "Address" },
  { name: "Siem Reap Night Market", detail: "Phsar Chas, Siem Reap", kind: "Address" },
  { name: "Siem Reap Angkor International Airport", detail: "National Road 6, Sotr Nikum", kind: "Address" },
  { name: "Royal Residence Park", detail: "Sivutha Boulevard, Siem Reap", kind: "Address" },
];

export function HotelSearch({ value, onChange, label, placeholder, onSelectPoint, cambodiaOnly = false }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string; onSelectPoint?: (point: { latitude: number; longitude: number }) => void; cambodiaOnly?: boolean }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [remote, setRemote] = useState<{ query: string; places: { name: string; detail: string; kind: string; latitude?: number; longitude?: number }[] } | null>(null);
  const [history, setHistory] = useState<{ userId: string; places: string[] } | null>(null);
  const [failure, setFailure] = useState<"places.historyError" | "places.searchError" | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    if (user?.role !== "customer") return;
    const controller = new AbortController();
    void fetch("/api/bookings/places", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Place history unavailable");
      const data = z.object({ places: z.array(z.string()) }).parse(await response.json());
      setHistory({ userId: user.id, places: data.places });
    }).catch(() => { if (!controller.signal.aborted) setFailure("places.historyError"); });
    return () => controller.abort();
  }, [user?.id, user?.role]);
  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 2 || /^GPS:/i.test(query)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchPlaces(query, AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), cambodiaOnly).then((places) => {
        if (!controller.signal.aborted) { setRemote({ query, places: places.map((place) => ({ ...place, kind: t("places.place") })) }); setFailure(null); }
      }).catch(() => { if (!controller.signal.aborted) setFailure("places.searchError"); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, focused, t, cambodiaOnly]);
  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const previous = history?.userId === user?.id ? history?.places.map((name) => ({ name, detail: "", kind: t("places.previous") })) ?? [] : [];
    const online = remote?.query === value.trim() ? remote.places : [];
    const matches = (place: { name: string; detail: string }) => !query || `${place.name} ${place.detail}`.toLowerCase().includes(query);
    const all = [...previous.filter(matches), ...online, ...destinations.filter(matches)];
    const seen = new Set<string>();
    return all.filter((place) => { const key = `${place.name}, ${place.detail}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 8);
  }, [value, remote, history, user?.id, t]);

  function select(index: number) {
    const place = suggestions[index];
    if (!place) return;
    onChange([place.name, place.detail].filter(Boolean).join(", "));
    if ("latitude" in place && "longitude" in place && typeof place.latitude === "number" && typeof place.longitude === "number") onSelectPoint?.({ latitude: place.latitude, longitude: place.longitude });
    setFocused(false); setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{label || t("booking.destinationLabel")}</label>
      <input
        id={id}
        value={value}
        onChange={(event) => { onChange(event.target.value); setActiveIndex(-1); setFocused(true); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={focused && suggestions.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={focused && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") setFocused(false);
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setFocused(true); setActiveIndex((current) => Math.max(0, Math.min(suggestions.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))); }
          if (event.key === "Enter" && focused && activeIndex >= 0) { event.preventDefault(); select(activeIndex); }
        }}
        required
        autoComplete="off"
        placeholder={placeholder || t("booking.destinationPlaceholder")}
        className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
      />
      {focused && suggestions.length > 0 && (
        <ul id={`${id}-list`} className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
          {suggestions.map((destination, index) => (
            <li key={`${destination.name}-${destination.detail}`} id={`${id}-option-${index}`} role="option" aria-selected={activeIndex === index}>
              <button type="button" tabIndex={-1} onPointerDown={(event) => event.preventDefault()} onClick={() => select(index)} className={`flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-[var(--color-background)] ${activeIndex === index ? "bg-slate-100" : ""}`}>
                <span><span className="block text-sm font-semibold text-[var(--color-text)]">{destination.name}</span><span className="mt-0.5 block text-xs text-slate-500">{destination.detail}</span></span>
                <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">{destination.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {focused && failure && <p role="status" className="mt-2 text-xs text-red-700">{t(failure)}</p>}
    </div>
  );
}
