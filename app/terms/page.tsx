import type { ReactNode } from "react";

const sections = [
  {
    title: "1. Service and agreement",
    paragraphs: [
      "These Terms of Service govern your use of SAIWAY and any booking for a private airport or city transfer arranged through our website. By submitting a booking, you agree to these Terms and to the price and trip details shown at checkout.",
      "SAIWAY acts as the booking and customer-service operator. The transfer is performed by SAIWAY or an independent driver or transport partner authorised to provide the service in Cambodia. The applicable driver and vehicle details are provided in the booking confirmation when available.",
    ],
  },
  {
    title: "2. Booking and passenger information",
    paragraphs: [
      "You must provide accurate passenger, contact, pickup, destination and flight information. You are responsible for checking the confirmation and promptly telling us about any error. A booking is accepted when SAIWAY sends a confirmation or otherwise confirms the ride.",
      "The person making the booking confirms that they are authorised to book for all passengers. Passengers must follow the driver's reasonable safety instructions and comply with Cambodian road-safety requirements during the journey.",
    ],
  },
  {
    title: "3. Price and payment",
    paragraphs: [
      "The total fare, currency and included services are shown before you submit the booking. Unless expressly stated otherwise, the fare includes the vehicle, driver, the stated passenger allowance and ordinary waiting terms shown in your confirmation. Optional services, additional waiting, extra stops or changes may carry an additional charge.",
      "Payment is due through the payment method presented at checkout. We may use a third-party payment provider; its terms and privacy notice also apply to payment processing. SAIWAY does not store full payment-card details unless clearly stated in the payment provider's flow.",
    ],
  },
  {
    title: "4. Airport pickup and delays",
    paragraphs: [
      "For an airport pickup, provide your flight number whenever possible. We may use flight information to monitor an expected arrival. You must follow the meeting instructions in the confirmation and keep your phone reachable.",
      "Reasonable included waiting time and the treatment of flight delays are stated in the booking confirmation or the Cancellation Policy. If we cannot locate you after the applicable waiting period, the booking may be treated as a no-show.",
    ],
  },
  {
    title: "5. Luggage, safety and conduct",
    paragraphs: [
      "The booking is limited to the passenger and luggage capacity shown for the selected vehicle. Tell us in advance about oversized luggage, mobility equipment, child seats or other special requirements. We may refuse unsafe or materially over-capacity luggage.",
      "Smoking, carrying illegal or dangerous goods, damaging the vehicle, threatening conduct and travelling under the influence in a way that creates a safety risk are prohibited. We may end a trip without refund where reasonably necessary for safety or legal compliance.",
    ],
  },
  {
    title: "6. Changes, cancellation and refunds",
    paragraphs: [
      "Changes and cancellations are handled under the Cancellation Policy published on this website and any specific terms shown in your booking confirmation. Where a refund is due, it is normally returned to the original payment method, subject to payment-provider processing times.",
      "If SAIWAY cancels a confirmed transfer and cannot offer a suitable replacement, you may choose a full refund or an alternative arrangement agreed with us.",
    ],
  },
  {
    title: "7. Responsibility and limits",
    paragraphs: [
      "We will use reasonable care to arrange the booked service. We are not responsible for delay or failure caused by events outside reasonable control, including severe weather, road closures, traffic incidents, public emergencies, government action, strikes or inaccurate information supplied by a passenger.",
      "Nothing in these Terms excludes or limits liability that cannot lawfully be excluded under Cambodian law, including liability for death or personal injury caused by negligence, fraud or other mandatory consumer protections. Subject to those mandatory rights, SAIWAY is not liable for indirect loss, missed onward travel or loss caused by a passenger's failure to follow the booking instructions.",
    ],
  },
  {
    title: "8. Governing law and contact",
    paragraphs: [
      "These Terms are intended to operate consistently with applicable Cambodian rules, including the Law on Consumer Protection (2019), the Law on E-Commerce (2019), the Road Traffic Law (2014), the Civil Code and any licensing or passenger-transport requirements applicable to the service. Where a mandatory rule conflicts with these Terms, that rule prevails.",
      "These Terms are governed by the laws of the Kingdom of Cambodia. We will first try to resolve a complaint in good faith. If a dispute cannot be resolved, it may be submitted to a competent court in Cambodia, subject to any mandatory rights available to a consumer.",
      "For questions, changes or complaints, contact SAIWAY through the contact details shown on your booking confirmation. Please include your booking reference.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms of Service" updated="12 September 2026">
      <p className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 text-sm leading-6 text-[var(--color-text)]">
        This is a customer-facing draft for SAIWAY&apos;s Cambodian transfer service. It should be reviewed and approved by qualified Cambodian counsel before launch, especially after the legal entity, licence, payment provider and transport partners are finalised.
      </p>
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-bold text-[var(--color-text)]">{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 leading-7 text-slate-600">{paragraph}</p>)}
        </section>
      ))}
    </LegalLayout>
  );
}

function LegalLayout({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">{title}</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: {updated}</p>
        <div className="mt-8 space-y-8 text-base">{children}</div>
      </div>
    </div>
  );
}
