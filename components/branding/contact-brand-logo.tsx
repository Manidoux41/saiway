import { contactBrandArt, type ContactBrand } from "@/lib/contact-brand-art";

export function ContactBrandLogo({ brand }: { brand: ContactBrand }) {
  const art = contactBrandArt[brand];
  return <svg viewBox="0 0 24 24" role="img" aria-label={art.label}>
    <rect width="24" height="24" rx={brand === "SAIWAY" ? 6 : 12} fill={art.color} />
    {brand === "SAIWAY" ? <>
      <path d={art.path} fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="8" cy="7" r="3" fill="#e00025" stroke="#fff" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="2.5" fill="#fff" />
    </> : <>
      <path d={art.path} fill={brand === "TELEGRAM" ? "#fff" : "none"} stroke={brand === "WHATSAPP" ? "#fff" : "none"} strokeWidth="1.5" />
      {art.phone && <path d={art.phone} fill="#fff" />}
    </>}
  </svg>;
}
