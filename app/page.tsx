import HomePage from "@/components/home-page";
import { currentAccount } from "@/lib/access";
import { roleHome } from "@/lib/roles";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  const account = await currentAccount();
  if (account && account.role !== "CUSTOMER") redirect(roleHome(account.role));
  const background = await prisma.systemSetting.findUnique({ where: { key: "heroBackground" } });
  return <HomePage background={background?.value} />;
}
