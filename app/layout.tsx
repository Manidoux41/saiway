import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { currentAccount } from "@/lib/access";
import type { UserRole } from "@/lib/roles";
import { appleStartupImages } from "@/lib/pwa-assets.mjs";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "SAIWAY | Siem Reap Airport Transfers",
  description:
    "Book a private airport transfer from Siem Reap Angkor International Airport to your hotel. Simple booking, trusted drivers and live tracking.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/saiway-mark.svg", type: "image/svg+xml" }, { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" }],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { capable: true, title: "SAIWAY", statusBarStyle: "default", startupImage: appleStartupImages },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = { themeColor: "#032ea1" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const account = await currentAccount();
  const initialUser = account ? { id: account.id, name: account.name, email: account.email, role: account.role.toLowerCase() as UserRole } : null;
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--color-background)] text-[var(--color-text)]">
        <LanguageProvider>
          <AuthProvider initialUser={initialUser}>
            <ServiceWorkerRegister />
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
