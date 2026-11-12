import { AccountDeletionPage } from "@/components/account-deletion-page";
import { publicContact } from "@/lib/public-contact";

export const dynamic = "force-dynamic";
export default async function Page() {
  let email: string | undefined;
  try { email = (await publicContact()).email; }
  catch { console.error("Account deletion public contact unavailable"); }
  return <AccountDeletionPage email={email} />;
}
