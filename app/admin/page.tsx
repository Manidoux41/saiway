"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { useState } from "react";
import { BookOpen, BriefcaseBusiness, CarFront, Megaphone, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useAdminManagement } from "@/components/admin/use-admin-management";
import { AdminBookings } from "@/components/admin/admin-bookings";
import { FleetSupervision } from "@/components/admin/fleet-supervision";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import styles from "@/components/admin/admin-dashboard.module.css";
import { DashboardMenu, DashboardSection, DashboardWorkspace } from "@/components/layout/dashboard-menu";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";
import { enumLabel } from "@/components/i18n/enum-label";

const BlogPanel = dynamic(() => import("@/components/admin/blog-panel").then((module) => module.BlogPanel));
const AdvertisingPanel = dynamic(() => import("@/components/admin/advertising-panel").then((module) => module.AdvertisingPanel));
const ManagementMenu = dynamic(() => import("@/components/admin/management-panel").then((module) => module.ManagementMenu));
const ManagementPanel = dynamic(() => import("@/components/admin/management-panel").then((module) => module.ManagementPanel));
const AccountCreationForm = dynamic(() => import("@/components/admin/account-creation-form").then((module) => module.AccountCreationForm));
const RecordEditor = dynamic(() => import("@/components/admin/record-editor").then((module) => module.RecordEditor));
const AccountProfile = dynamic(() => import("@/components/admin/account-profile-editor").then((module) => module.AccountProfile));
const EmployerSettingsForm = dynamic(() => import("@/components/admin/employer-settings-form").then((module) => module.EmployerSettingsForm));

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, error, loading, refresh } = useAdminManagement(user?.role === "admin" ? user.id : undefined);
  const [section, setSection] = useState<"operations" | "accounts" | "management" | "security" | "blog" | "advertising">("operations");
  const [visited, setVisited] = useState({ accounts: false, management: false, blog: false, advertising: false });
  const [accountRole, setAccountRole] = useState<"CUSTOMER" | "DRIVER" | "ADMIN">("CUSTOMER");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [employerVersion, setEmployerVersion] = useState(0);
  const accounts = useListSort(data?.users ?? [], [
    { key: "created", label: t("sorting.created"), value: (item) => sortDate(item.createdAt) },
    { key: "name", label: t("records.name"), value: (item) => item.name },
    { key: "email", label: t("records.email"), value: (item) => item.email },
    { key: "role", label: t("ui.role"), value: (item) => enumLabel(item.role, t) },
    { key: "status", label: t("records.status"), value: (item) => enumLabel(item.status, t) },
  ], { key: "created", direction: "desc" });
  const sections = [{ key: "operations", icon: BriefcaseBusiness }, { key: "accounts", icon: Users }, { key: "management", icon: CarFront }, { key: "blog", icon: BookOpen }, { key: "advertising", icon: Megaphone }, { key: "security", icon: ShieldCheck }] as const;
  return <div className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>SAIWAY / {t("nav.adminDashboard")}</span><h1>{t("dispatch.title")}</h1><p>{t("driver.localTime")}</p></div><button type="button" className={styles.iconButton} disabled={loading} onClick={refresh} title={t("admin.retry")} aria-label={t("admin.retry")}><RefreshCw size={19} /></button></header>
    <DashboardWorkspace menu={<>
      <nav className="grid gap-2" aria-label={t("nav.adminDashboard")}>{sections.map(({ key, icon: Icon }) => <button key={key} type="button" aria-pressed={section === key} className={`flex min-h-12 items-center gap-3 rounded-xl p-3 text-left text-sm font-semibold ${section === key ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection(key); if (key === "accounts" || key === "management" || key === "blog" || key === "advertising") setVisited((current) => ({ ...current, [key]: true })); }}><Icon size={17} aria-hidden="true" />{t(key === "blog" ? "blog.admin" : key === "advertising" ? "ads.admin" : `dispatch.${key}`)}</button>)}</nav>
      {section === "management" && data && <ManagementMenu />}
      {section === "accounts" && <DashboardMenu groups={[{ title: t("dispatch.accounts"), items: [
        { title: t("dashboard.createAccount"), target: "admin-create-account-section" },
        { title: t("records.users"), target: "admin-directory-section" },
        { title: t("dashboard.employer"), target: "admin-employer-section" },
      ] }]} />}
    </>}>
    {error && <div role="alert" className={styles.error}>{t(error)} <button onClick={refresh} disabled={loading} className="underline">{t("admin.retry")}</button> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></div>}
    <div hidden={section !== "operations"}><FleetSupervision /><AdminBookings management={data} disabled={loading || Boolean(error)} /></div>
    {visited.accounts && <div hidden={section !== "accounts"} className="space-y-4">
      <DashboardSection id="admin-create-account-section" title={t("dashboard.createAccount")}>
        <div className={styles.views} role="group" aria-label={t("records.users")}>{(["CUSTOMER", "DRIVER", "ADMIN"] as const).map((role) => <button key={role} type="button" aria-pressed={accountRole === role} onClick={() => setAccountRole(role)}>{t(role === "CUSTOMER" ? "courses.createCustomer" : role === "DRIVER" ? "admin.createDriver" : "admin.createAdministrator")}</button>)}</div>
        <div className={styles.accountForm}><AccountCreationForm key={accountRole} role={accountRole} disabled={loading || Boolean(error)} onCreated={refresh} /></div>
      </DashboardSection>
      <DashboardSection id="admin-directory-section" title={t("records.users")}>
        <div className={styles.sectionHeading}><h2>{t("records.users")}</h2><span className={styles.muted}>{data?.users.length ?? 0}</span></div>
        {accounts.controls}
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t("records.name")}</th><th>{t("records.email")}</th><th>{t("courses.entity")}</th><th>{t("records.status")}</th><th>{t("profile.actions")}</th></tr></thead><tbody>{accounts.items.map((account) => <tr key={account.id} data-selected={profileId === account.id}><td>{account.name}</td><td>{account.email}</td><td>{t(account.role === "DRIVER" ? "admin.driver" : account.role === "CUSTOMER" ? "courses.customer" : "admin.administratorTitle")}</td><td>{t(account.status === "ACTIVE" ? "admin.active" : account.status === "SUSPENDED" ? "admin.suspended" : "admin.invited")}</td><td><button type="button" onClick={() => setProfileId(account.id)} aria-label={`${t("profile.edit")} · ${account.name}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">{t("profile.edit")}</button></td></tr>)}</tbody></table></div>
        {profileId && <AccountProfile key={`${profileId}-${employerVersion}`} userId={profileId} currentUserId={user?.id} onChanged={refresh} onClose={() => setProfileId(null)} />}
      </DashboardSection>
      <DashboardSection id="admin-employer-section" title={t("dashboard.employer")}><EmployerSettingsForm onChanged={() => setEmployerVersion((value) => value + 1)} /></DashboardSection>
    </div>}
    {visited.management && <div hidden={section !== "management"}><ManagementPanel data={data} loading={loading} loadError={error} onReload={refresh} />{data && <DashboardSection id="admin-records-section" title={t("dashboard.records")}><RecordEditor data={data} disabled={loading || Boolean(error)} refresh={refresh} /></DashboardSection>}</div>}
    {section === "security" && <section className={styles.security}><h2>{t("dispatch.security")}</h2><ChangePasswordForm /></section>}
    {visited.blog && <div hidden={section !== "blog"}><BlogPanel /></div>}
    {visited.advertising && <div hidden={section !== "advertising"}><AdvertisingPanel /></div>}
    </DashboardWorkspace>
  </div>;
}
