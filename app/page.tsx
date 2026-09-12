"use client";

import Link from "next/link";
import { BookingWidget } from "@/components/booking/booking-widget";
import { useLanguage } from "@/components/i18n/language-provider";
import { defaultHeroBackground } from "@/lib/site";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { t } = useLanguage();
  const [heroBackground, setHeroBackground] = useState(() => {
    if (typeof window === "undefined") return defaultHeroBackground;
    const storedBackground = window.localStorage.getItem("saiway-hero-background");
    return storedBackground && !storedBackground.includes("images.unsplash.com") ? storedBackground : defaultHeroBackground;
  });
  const trustItems = [t("home.fixedPrice"), t("home.professionalDriver"), t("home.doorToDoor"), t("home.flightDetails"), t("home.liveTracking"), t("home.securePayment")];
  const stats = [{ label: t("home.sameDay"), value: "24/7" }, { label: t("home.averageEta"), value: "8 min" }, { label: t("home.driverNetwork"), value: "50+" }];

  useEffect(() => {
    function updateBackground(event: Event) {
      setHeroBackground((event as CustomEvent<string>).detail || defaultHeroBackground);
    }

    window.addEventListener("saiway-hero-background-changed", updateBackground);
    return () => window.removeEventListener("saiway-hero-background-changed", updateBackground);
  }, []);

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
      <section className="relative overflow-hidden bg-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(3, 31, 115, 0.9) 0%, rgba(3, 46, 161, 0.72) 42%, rgba(3, 46, 161, 0.35) 100%), url("${heroBackground}")`, backgroundPosition: "center 18%" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-full border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                {t("home.eyebrow")}
              </p>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                {t("home.title")}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/85">
                {t("home.subtitle")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/booking" className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">
                {t("home.book")}
              </Link>
              <Link href="/booking/track" className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-[var(--color-primary)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)]/5">
                {t("home.track")}
              </Link>
            </div>
          </div>

          <BookingWidget />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <div className="text-3xl font-black text-[var(--color-primary)]">{stat.value}</div>
              <div className="mt-2 text-sm text-slate-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div className="rounded-[30px] bg-[var(--color-primary-dark)] p-8 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("home.why")}</p>
          <h2 className="mt-4 text-3xl font-bold">{t("home.whyTitle")}</h2>
          <p className="mt-4 max-w-lg text-white/80">
            {t("home.whyText")}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90">
                ✓ {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-black/5 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{t("home.fromAirport")}</p>
          <h3 className="mt-4 text-2xl font-bold text-[var(--color-text)]">{t("home.toDoor")}</h3>
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl bg-[var(--color-background)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("home.pickup")}</div>
              <div className="mt-2 text-base font-semibold">SAI Airport</div>
            </div>
            <div className="rounded-2xl bg-[var(--color-background)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("home.destination")}</div>
              <div className="mt-2 text-base font-semibold">{t("home.hotel")}</div>
            </div>
            <div className="rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{t("home.price")}</div>
              <div className="mt-2 text-3xl font-black text-[var(--color-text)]">$35</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-black/5 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{t("home.fastFlow")}</p>
              <h3 className="mt-2 text-3xl font-bold text-[var(--color-text)]">{t("home.flow")}</h3>
            </div>
            <Link href="/booking" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
              {t("home.explore")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
