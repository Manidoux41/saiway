"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { FormEvent, useState } from "react";
import { defaultHeroBackground, defaultHeroBackgroundCredit } from "@/lib/site";
import { ManagementPanel } from "@/components/admin/management-panel";
import { AccountCreationForm } from "@/components/admin/account-creation-form";
import { useAdminManagement } from "@/components/admin/use-admin-management";

const stats = [
  { label: "Bookings", value: "12" },
  { label: "Confirmed", value: "8" },
  { label: "On trip", value: "3" },
  { label: "Needs driver", value: "1" },
  { label: "Revenue", value: "$420" },
  { label: "Live vehicles", value: "6" },
];

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, error, loading, refresh } = useAdminManagement(user?.role === "admin" ? user.id : undefined);
  const drivers = data?.users.filter((account) => account.role === "DRIVER") ?? [];
  const customers = data?.users.filter((account) => account.role === "CUSTOMER") ?? [];
  const [fare, setFare] = useState("35");
  const [heroBackground, setHeroBackground] = useState(() => {
    if (typeof window === "undefined") return defaultHeroBackground;
    const storedBackground = window.localStorage.getItem("saiway-hero-background");
    return storedBackground && !storedBackground.includes("images.unsplash.com") ? storedBackground : defaultHeroBackground;
  });

  if (!user || user.role !== "admin") {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-3xl font-black text-[var(--color-text)]">{t("admin.accessRequired")}</h1><p className="mt-4 text-slate-600">{t("admin.accessText")}</p><Link href="/auth" className="mt-6 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">{t("admin.openSignIn")}</Link></div>;
  }

  function saveHeroBackground(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!heroBackground.startsWith("https://")) return;
    window.localStorage.setItem("saiway-hero-background", heroBackground);
    window.dispatchEvent(new CustomEvent("saiway-hero-background-changed", { detail: heroBackground }));
  }

  function restoreHeroBackground() {
    setHeroBackground(defaultHeroBackground);
    window.localStorage.setItem("saiway-hero-background", defaultHeroBackground);
    window.dispatchEvent(new CustomEvent("saiway-hero-background-changed", { detail: defaultHeroBackground }));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("admin.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">SAIWAY</h1>
      </div>
      {error && <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[var(--color-error)]">{t(error)} <button type="button" onClick={refresh} disabled={loading} className="font-semibold underline">{t("admin.retry")}</button>{error === "admin.sessionExpired" && <> <Link href="/auth" className="font-semibold underline">{t("admin.openSignIn")}</Link></>}</div>}
      <p className="mb-4 text-sm text-slate-500">{t("admin.demoNotice")}</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{stat.label}</div>
            <div className="mt-4 text-3xl font-black text-[var(--color-primary-dark)]">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--color-text)]">{t("admin.newBookings")}</h2>
          <button disabled className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white opacity-50">
            {t("admin.assign")}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">SAI → HOTEL</div>
                <div className="mt-2 text-lg font-bold text-[var(--color-text)]">15 Sep · 14:30</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">2 {t("admin.passengers")}</div>
                <div className="text-sm font-semibold text-[var(--color-text)]">Toyota Alphard</div>
                <div className="mt-1 text-lg font-black text-[var(--color-primary)]">$35</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{t("admin.heroAppearance")}</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">{t("admin.heroBackground")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("admin.heroHelp")} The default image is a photograph of the main Angkor Wat complex from Wikimedia Commons.</p>
          <form onSubmit={saveHeroBackground} className="mt-5 flex flex-col gap-3 md:flex-row">
            <input aria-label="Hero background image URL" value={heroBackground} onChange={(event) => setHeroBackground(event.target.value)} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
            <button type="submit" className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">{t("admin.saveBackground")}</button>
            <button type="button" onClick={restoreHeroBackground} className="rounded-full border border-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-primary)]">{t("admin.restoreAngkor")}</button>
          </form>
          <div className="mt-5 h-40 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url("${heroBackground}")` }} aria-label="Hero background preview" />
          <p className="mt-3 text-xs text-slate-500">Default credit: {defaultHeroBackgroundCredit}. Keep an appropriate credit when using this image.</p>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{t("admin.people")}</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">{t("admin.customers")}</h2></div>{data && <span className="rounded-full bg-[var(--color-background)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">{customers.length} {t("admin.registered")}</span>}</div>
          <div className="mt-5 space-y-3">{!data ? <p className="text-sm text-slate-500">{t(error ? "admin.dataUnavailable" : "admin.loading")}</p> : customers.length === 0 ? <p className="text-sm text-slate-500">{t("admin.noCustomers")}</p> : customers.map((customer) => <div key={customer.id} className="flex items-center justify-between rounded-2xl bg-[var(--color-input)] p-4"><div><div className="font-semibold text-[var(--color-text)]">{customer.name}</div><div className="text-sm text-slate-500">{customer.email}</div></div><span className="text-xs font-semibold">{t(customer.status === "ACTIVE" ? "admin.active" : customer.status === "SUSPENDED" ? "admin.suspended" : "admin.invited")}</span></div>)}</div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Security</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">{t("admin.administratorTitle")}</h2>
          <p className="mt-2 text-sm text-slate-600">{t("admin.administratorHelp")}</p>
          <AccountCreationForm role="ADMIN" disabled={loading || Boolean(error)} onCreated={refresh} />
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Admin only</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">{t("admin.driverTitle")}</h2><p className="mt-2 text-sm text-slate-600">{t("admin.driverHelp")}</p>
          <AccountCreationForm role="DRIVER" disabled={loading || Boolean(error)} onCreated={refresh} />
          <div className="mt-5 space-y-2">{!data ? <p className="text-sm text-slate-500">{t(error ? "admin.dataUnavailable" : "admin.loading")}</p> : drivers.length === 0 ? <p className="text-sm text-slate-500">{t("admin.noDrivers")}</p> : drivers.map((driver) => <div key={driver.id} className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="font-semibold text-[var(--color-text)]">{driver.name}<span className="ml-2 font-normal text-slate-500">{driver.email}</span></span><span className={driver.status === "ACTIVE" ? "text-emerald-700" : "text-slate-500"}>{t(driver.status === "ACTIVE" ? "admin.active" : driver.status === "SUSPENDED" ? "admin.suspended" : "admin.invited")}</span></div>)}</div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Pricing</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Airport transfer fare</h2><div className="mt-5 flex items-end gap-3"><label htmlFor="fare" className="flex-1"><span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Base fare in USD</span><input id="fare" disabled type="number" min="1" value={fare} onChange={(event) => setFare(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-2xl font-black outline-none focus:border-[var(--color-primary)]" /></label><button disabled type="button" className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white opacity-50">Save fare</button></div><p className="mt-3 text-xs text-slate-500">{t("admin.pricingDemo")}</p></section>
      </div>
      <ManagementPanel data={data} loading={loading} loadError={error} onReload={refresh} />
    </div>
  );
}
