import AuthForm from "@/components/auth/auth-form";
import { currentAccount } from "@/lib/access";
import { roleHome } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function AuthPage() {
  const account = await currentAccount();
  if (account) redirect(roleHome(account.role));
  return <AuthForm />;
}
