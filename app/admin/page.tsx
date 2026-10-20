"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { useState } from "react";
import { BriefcaseBusiness, CarFront, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { ManagementPanel } from "@/components/admin/management-panel";
import { AccountCreationForm } from "@/components/admin/account-creation-form";
import { useAdminManagement } from "@/components/admin/use-admin-management";
import { AdminBookings } from "@/components/admin/admin-bookings";
import { RecordEditor } from "@/components/admin/record-editor";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import styles from "@/components/admin/admin-dashboard.module.css";

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data, error, loading, refresh } = useAdminManagement(user?.role === "admin" ? user.id : undefined);
  const [section, setSection] = useState<"operations" | "accounts" | "management" | "security">("operations");
  const [accountRole, setAccountRole] = useState<"CUSTOMER" | "DRIVER" | "ADMIN">("CUSTOMER");
  const sections = [{ key: "operations", icon: BriefcaseBusiness }, { key: "accounts", icon: Users }, { key: "management", icon: CarFront }, { key: "security", icon: ShieldCheck }] as const;
  return <div className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>SAIWAY / {t("nav.adminDashboard")}</span><h1>{t("dispatch.title")}</h1><p>{t("driver.localTime")}</p></div><button type="button" className={styles.iconButton} disabled={loading} onClick={refresh} title={t("admin.retry")} aria-label={t("admin.retry")}><RefreshCw size={19} /></button></header>
    <nav className={styles.navigation} aria-label={t("nav.adminDashboard")}>{sections.map(({ key, icon: Icon }) => <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}><Icon size={17} />{t(`dispatch.${key}`)}</button>)}</nav>
    {error && <div role="alert" className={styles.error}>{t(error)} <button onClick={refresh} disabled={loading} className="underline">{t("admin.retry")}</button> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></div>}
    <div hidden={section !== "operations"}><AdminBookings management={data} disabled={loading || Boolean(error)} /></div>
    {section === "accounts" && <section className={styles.accounts}><div className={styles.sectionHeading}><h2>{t("records.users")}</h2><span className={styles.muted}>{data?.users.length ?? 0}</span></div><div className={styles.views} role="group" aria-label={t("records.users")}>{(["CUSTOMER", "DRIVER", "ADMIN"] as const).map((role) => <button key={role} type="button" aria-pressed={accountRole === role} onClick={() => setAccountRole(role)}>{t(role === "CUSTOMER" ? "courses.createCustomer" : role === "DRIVER" ? "admin.createDriver" : "admin.createAdministrator")}</button>)}</div><div className={styles.accountForm}><AccountCreationForm key={accountRole} role={accountRole} disabled={loading || Boolean(error)} onCreated={refresh} /></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t("records.name")}</th><th>{t("records.email")}</th><th>{t("courses.entity")}</th><th>{t("records.status")}</th></tr></thead><tbody>{data?.users.map((account) => <tr key={account.id}><td>{account.name}</td><td>{account.email}</td><td>{t(account.role === "DRIVER" ? "admin.driver" : account.role === "CUSTOMER" ? "courses.customer" : "admin.administratorTitle")}</td><td>{t(account.status === "ACTIVE" ? "admin.active" : account.status === "SUSPENDED" ? "admin.suspended" : "admin.invited")}</td></tr>)}</tbody></table></div></section>}
    {section === "management" && <><ManagementPanel data={data} loading={loading} loadError={error} onReload={refresh} />{data && <RecordEditor data={data} disabled={loading || Boolean(error)} refresh={refresh} />}</>}
    {section === "security" && <section className={styles.security}><h2>{t("dispatch.security")}</h2><ChangePasswordForm /></section>}
  </div>;
}
