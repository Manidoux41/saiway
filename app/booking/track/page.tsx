import { Suspense } from "react";
import { LiveTracking } from "@/components/booking/live-tracking";

export default function TrackingPage() {
  return <Suspense fallback={null}><LiveTracking /></Suspense>;
}
