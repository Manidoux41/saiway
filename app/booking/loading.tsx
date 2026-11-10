import { Logo } from "@/components/branding/logo";

export default function Loading() {
  return <div className="mx-auto w-full max-w-7xl px-4 py-12" aria-busy="true" aria-label="SAIWAY">
    <Logo />
    <div aria-hidden="true" className="mt-8 grid animate-pulse gap-6">
      <div className="h-10 w-2/3 rounded-2xl bg-slate-200" />
      <div className="h-5 w-1/2 rounded-xl bg-slate-200" />
      <div className="h-72 rounded-3xl border border-slate-200 bg-white" />
    </div>
  </div>;
}
