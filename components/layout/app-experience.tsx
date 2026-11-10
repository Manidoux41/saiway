"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AngkorWatBackground } from "@/components/branding/angkor-wat-background";
import { AdvertisingSlots } from "@/components/advertising/advertising-slots";

export function AppExperience({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const pathname = usePathname();
  const space = pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : pathname === "/driver" || pathname.startsWith("/driver/") ? "driver" : "public";
  const placement = pathname === "/" ? "HOME" : pathname === "/blog" || pathname.startsWith("/blog/") ? "BLOG" : pathname === "/booking" ? "BOOKING" : pathname === "/driver" ? "DRIVER" : null;
  return <div data-app-space={space} className="saiway-app-shell flex min-h-screen flex-col">
    <div className="saiway-atmosphere" aria-hidden="true" />
    <div className="saiway-angkor-decor" aria-hidden="true"><AngkorWatBackground /></div>
    {children}
    {placement && <AdvertisingSlots key={placement} placement={placement} />}
    {footer}
  </div>;
}
