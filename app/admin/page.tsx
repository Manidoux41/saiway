"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { FormEvent, useState } from "react";
import { defaultHeroBackground, defaultHeroBackgroundCredit } from "@/lib/site";
import { ManagementPanel } from "@/components/admin/management-panel";

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
  const [drivers, setDrivers] = useState([{ name: "Sokha", email: "sokha@saiway.local", status: "Active" }]);
  const [vehicles, setVehicles] = useState([{ name: "Toyota Alphard", plate: "2B-4567", seats: 6 }]);
  const [fare, setFare] = useState("35");
  const [driverForm, setDriverForm] = useState({ name: "", email: "", password: "" });
  const [vehicleForm, setVehicleForm] = useState({ name: "", plate: "", seats: "4" });
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });
  const [adminMessage, setAdminMessage] = useState("");
  const [heroBackground, setHeroBackground] = useState(() => {
    if (typeof window === "undefined") return defaultHeroBackground;
    const storedBackground = window.localStorage.getItem("saiway-hero-background");
    return storedBackground && !storedBackground.includes("images.unsplash.com") ? storedBackground : defaultHeroBackground;
  });

  if (!user || user.role !== "admin") {
    return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-3xl font-black text-[var(--color-text)]">{t("admin.accessRequired")}</h1><p className="mt-4 text-slate-600">{t("admin.accessText")}</p><Link href="/auth" className="mt-6 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">{t("admin.openSignIn")}</Link></div>;
  }

  function createDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...driverForm, role: "DRIVER" }) }).then(async (response) => {
      if (response.ok) {
        setDrivers((current) => [...current, { name: driverForm.name, email: driverForm.email, status: "Active" }]);
        setDriverForm({ name: "", email: "", password: "" });
      }
    });
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adminForm) });
    const data = await response.json() as { error?: string };
    setAdminMessage(response.ok ? "Administrator created successfully." : data.error || "Unable to create administrator.");
    if (response.ok) setAdminForm({ name: "", email: "", password: "" });
  }

  function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVehicles((current) => [...current, { name: vehicleForm.name, plate: vehicleForm.plate, seats: Number(vehicleForm.seats) }]);
    setVehicleForm({ name: "", plate: "", seats: "4" });
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
          <button className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">
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
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">People</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Customers</h2></div><span className="rounded-full bg-[var(--color-background)] px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">12 registered</span></div>
          <div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-2xl bg-[var(--color-input)] p-4"><div><div className="font-semibold text-[var(--color-text)]">Nary Chan</div><div className="text-sm text-slate-500">nary@example.com</div></div><span className="text-xs font-semibold text-emerald-700">Active</span></div><div className="flex items-center justify-between rounded-2xl bg-[var(--color-input)] p-4"><div><div className="font-semibold text-[var(--color-text)]">David Morgan</div><div className="text-sm text-slate-500">david@example.com</div></div><span className="text-xs font-semibold text-emerald-700">Active</span></div></div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Security</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Create an administrator</h2>
          <p className="mt-2 text-sm text-slate-600">Only an authenticated administrator can create another administrator account.</p>
          <form onSubmit={createAdmin} className="mt-5 grid gap-3 md:grid-cols-3">
            <input required value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} placeholder="Administrator name" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
            <input required type="email" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} placeholder="Administrator email" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
            <input required minLength={8} type="password" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} placeholder="Temporary password" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
            <button type="submit" className="rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white md:col-span-3">Create administrator account</button>
          </form>
          {adminMessage && <p className="mt-3 text-sm font-semibold text-[var(--color-primary)]">{adminMessage}</p>}
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Admin only</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Create a driver</h2><p className="mt-2 text-sm text-slate-600">Drivers cannot self-register. Create their account here and send their credentials securely.</p>
          <form onSubmit={createDriver} className="mt-5 grid gap-3 sm:grid-cols-3"><input required value={driverForm.name} onChange={(event) => setDriverForm({ ...driverForm, name: event.target.value })} placeholder="Driver name" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" /><input required type="email" value={driverForm.email} onChange={(event) => setDriverForm({ ...driverForm, email: event.target.value })} placeholder="Driver email" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" /><input required minLength={8} type="password" value={driverForm.password} onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} placeholder="Temporary password" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" /><button type="submit" className="rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white sm:col-span-3">Create driver account</button></form>
          <div className="mt-5 space-y-2">{drivers.map((driver) => <div key={driver.email} className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm"><span className="font-semibold text-[var(--color-text)]">{driver.name}<span className="ml-2 font-normal text-slate-500">{driver.email}</span></span><span className="text-emerald-700">{driver.status}</span></div>)}</div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Pricing</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Airport transfer fare</h2><div className="mt-5 flex items-end gap-3"><label htmlFor="fare" className="flex-1"><span className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Base fare in USD</span><input id="fare" type="number" min="1" value={fare} onChange={(event) => setFare(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-2xl font-black outline-none focus:border-[var(--color-primary)]" /></label><button type="button" className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">Save fare</button></div><p className="mt-3 text-xs text-slate-500">Changes should be audited and published with an effective date in production.</p></section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Fleet</p><h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Vehicles</h2><form onSubmit={addVehicle} className="mt-5 grid gap-3 sm:grid-cols-3"><input required value={vehicleForm.name} onChange={(event) => setVehicleForm({ ...vehicleForm, name: event.target.value })} placeholder="Vehicle" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-3 py-3 text-sm outline-none focus:border-[var(--color-primary)]" /><input required value={vehicleForm.plate} onChange={(event) => setVehicleForm({ ...vehicleForm, plate: event.target.value })} placeholder="Plate" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-3 py-3 text-sm outline-none focus:border-[var(--color-primary)]" /><input required type="number" min="1" value={vehicleForm.seats} onChange={(event) => setVehicleForm({ ...vehicleForm, seats: event.target.value })} placeholder="Seats" className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-3 py-3 text-sm outline-none focus:border-[var(--color-primary)]" /><button type="submit" className="rounded-full border border-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-primary)] sm:col-span-3">Add vehicle</button></form><div className="mt-5 space-y-2">{vehicles.map((vehicle) => <div key={vehicle.plate} className="flex justify-between border-t border-slate-100 pt-3 text-sm"><span className="font-semibold text-[var(--color-text)]">{vehicle.name}</span><span className="text-slate-500">{vehicle.plate} · {vehicle.seats} seats</span></div>)}</div></section>
      </div>
      <ManagementPanel />
    </div>
  );
}
