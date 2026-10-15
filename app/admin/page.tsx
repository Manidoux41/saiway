"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { ManagementPanel } from "@/components/admin/management-panel";
import { AccountCreationForm } from "@/components/admin/account-creation-form";
import { useAdminManagement } from "@/components/admin/use-admin-management";
import { CourseDashboard } from "@/components/booking/course-dashboard";
import { RecordEditor } from "@/components/admin/record-editor";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, error, loading, refresh } = useAdminManagement(user?.role === "admin" ? user.id : undefined);
  return <div className="mx-auto max-w-7xl px-4 py-12">
    <h1 className="text-3xl font-black">{t("nav.adminDashboard")}</h1>
    <p className="mt-3 text-slate-600">{t("courses.adminScope")}</p>
    <ChangePasswordForm />
    {error && <div role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-[var(--color-error)]">{t(error)} <button onClick={refresh} disabled={loading} className="underline">{t("admin.retry")}</button> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></div>}
    <CourseDashboard role="admin" management={data} />
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t("admin.administratorTitle")}</h2><AccountCreationForm role="ADMIN" disabled={loading || Boolean(error)} onCreated={refresh} /></section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t("admin.driverTitle")}</h2><AccountCreationForm role="DRIVER" disabled={loading || Boolean(error)} onCreated={refresh} /><div className="mt-4 space-y-2">{data?.users.filter((account) => account.role === "DRIVER").map((driver) => <p key={driver.id}>{driver.name} · {driver.email} · {t(driver.status === "ACTIVE" ? "admin.active" : driver.status === "SUSPENDED" ? "admin.suspended" : "admin.invited")}</p>)}</div></section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t("courses.createCustomer")}</h2><AccountCreationForm role="CUSTOMER" disabled={loading || Boolean(error)} onCreated={refresh} /></section>
    </div>
    <ManagementPanel data={data} loading={loading} loadError={error} onReload={refresh} />
    {data && <RecordEditor data={data} disabled={loading || Boolean(error)} refresh={refresh} />}
  </div>;
}
