"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

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

export function HotelSearch({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string }) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return destinations.slice(0, 6);
    return destinations.filter((destination) => `${destination.name} ${destination.detail}`.toLowerCase().includes(query)).slice(0, 6);
  }, [value]);

  return (
    <div className="relative">
      <label htmlFor="destination" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{label || t("booking.destinationLabel")}</label>
      <input
        id="destination"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        required
        autoComplete="off"
        placeholder={placeholder || t("booking.destinationPlaceholder")}
        className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
      />
      {focused && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
          {suggestions.map((destination) => (
            <li key={`${destination.kind}-${destination.name}`}>
              <button type="button" onMouseDown={() => onChange(`${destination.name}, ${destination.detail}`)} className="flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-[var(--color-background)]">
                <span><span className="block text-sm font-semibold text-[var(--color-text)]">{destination.name}</span><span className="mt-0.5 block text-xs text-slate-500">{destination.detail}</span></span>
                <span className="shrink-0 rounded-full bg-[var(--color-primary)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">{destination.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
