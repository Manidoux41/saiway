"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import { LocationSharing } from "@/components/location/location-sharing";

const trips = [
  { time: "14:30", route: "SAI → Hotel", passengers: 2, status: "PAID", amount: "$35" },
  { time: "16:00", route: "City Center → Airport", passengers: 1, status: "PENDING", amount: "$18" },
];

export default function DriverPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("driver.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">{t("driver.today")}</h1>
      </div>

      <div className="space-y-4">
        {trips.map((trip) => (
          <div key={`${trip.time}-${trip.route}`} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-black text-[var(--color-text)]">{trip.time}</div>
                <div className="mt-1 text-xl font-bold text-[var(--color-primary-dark)]">{trip.route}</div>
                <div className="mt-2 text-sm text-slate-500">{trip.passengers} {t("driver.passengers")}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-700">
                  {trip.status}
                </div>
                <div className="text-lg font-black text-[var(--color-text)]">{trip.amount}</div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">
                {t("driver.accept")}
              </button>
            </div>
          </div>
        ))}
      </div>
      <LocationSharing mode="driver" />
    </div>
  );
}
