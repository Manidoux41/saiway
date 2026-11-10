"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, Compass, Handshake, MapPin, Plane, Route } from "lucide-react";
import { BookingWidget } from "@/components/booking/booking-widget";
import { useLanguage } from "@/components/i18n/language-provider";
import { defaultHeroBackground } from "@/lib/site";
import { FeaturedBlog } from "@/components/blog/blog-public";
import type { BlogCardData } from "@/lib/blog-client";

export default function HomePage({ background = defaultHeroBackground, featuredPosts = [], featuredError = false }: { background?: string; featuredPosts?: BlogCardData[]; featuredError?: boolean }) {
  const { t } = useLanguage();
  const heroBackground = background;
  const trustItems = [t("home.fixedPrice"), t("home.professionalDriver"), t("home.doorToDoor"), t("home.flightDetails"), t("home.liveTracking"), t("home.securePayment")];
  const experiences = [
    { icon: Plane, title: "home.arriveTitle", description: "home.arriveText" },
    { icon: Route, title: "home.moveTitle", description: "home.moveText" },
    { icon: Compass, title: "home.discoverTitle", description: "home.discoverText" },
  ] as const;

  return (
    <div className="min-h-screen text-[var(--color-text)]">
      <section className="saiway-hero relative overflow-hidden bg-[var(--color-primary-dark)]">
        <div aria-hidden="true" className="saiway-hero-landscape" style={{ backgroundImage: `linear-gradient(90deg, rgba(3, 31, 115, 0.85) 0%, rgba(3, 46, 161, 0.55) 42%, rgba(3, 46, 161, 0.15) 100%), url("${heroBackground}")` }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.14),_transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
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
              <Link href="/ride" className="saiway-action inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-[var(--color-primary)]">{t("guest.open")}</Link>
              <Link href="/booking" className="saiway-action inline-flex min-w-[220px] items-center justify-center rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">
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
          {experiences.map(({ icon: Icon, title, description }) => (
            <article key={title} className="saiway-reveal saiway-experience min-w-0 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <span className="inline-flex rounded-2xl bg-[var(--color-primary)]/5 p-3 text-[var(--color-primary)]"><Icon size={24} aria-hidden="true" /></span>
              <h2 className="mt-5 text-xl font-bold">{t(title)}</h2>
              <p className="mt-3 leading-7 text-slate-600">{t(description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div className="saiway-reveal saiway-cultural-panel rounded-[30px] bg-[var(--color-primary-dark)] p-8 text-white shadow-sm">
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

        <div className="saiway-reveal saiway-experience rounded-[30px] border border-black/5 bg-white p-8 shadow-sm">
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
              <Link href="/booking" className="mt-2 inline-flex items-center gap-2 font-bold text-[var(--color-primary)]">{t("booking.checkPrice")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>

      <FeaturedBlog posts={featuredPosts} error={featuredError} />

      <section aria-labelledby="partnerships-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="saiway-reveal saiway-cultural-panel grid gap-8 rounded-[30px] bg-[var(--color-primary-dark)] p-6 text-white sm:p-8 lg:grid-cols-2 lg:p-10">
          <div className="min-w-0">
            <Handshake size={32} aria-hidden="true" className="text-white/80" />
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("home.partnersEyebrow")}</p>
            <h2 id="partnerships-title" className="mt-3 text-3xl font-bold">{t("home.partnersTitle")}</h2>
            <p className="mt-4 leading-7 text-white/80">{t("home.partnersText")}</p>
            <a href="https://maps.app.goo.gl/fmXwg25Kor5XGM8f8" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-[var(--color-primary)]">
              <MapPin size={20} className="shrink-0" aria-hidden="true" />{t("home.partnersMeet")}<ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
            </a>
            <p className="mt-3 text-sm leading-6 text-white/70">Tiara Air Tour &amp; Travel · Siem Reap</p>
          </div>
          <div className="grid content-center gap-4">
            {([
              { icon: Building2, title: "home.partnerHotels", description: "home.partnerHotelsText" },
              { icon: Compass, title: "home.partnerAgencies", description: "home.partnerAgenciesText" },
              { icon: Route, title: "home.partnerDrivers", description: "home.partnerDriversText" },
            ] as const).map(({ icon: Icon, title, description }) => <article key={title} className="flex min-w-0 items-start gap-4 rounded-2xl border border-white/15 bg-white/5 p-5">
              <Icon size={24} aria-hidden="true" className="shrink-0 text-white/80" />
              <div className="min-w-0"><h3 className="text-lg font-bold">{t(title)}</h3><p className="mt-2 leading-6 text-white/80">{t(description)}</p></div>
            </article>)}
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
    </div>
  );
}
