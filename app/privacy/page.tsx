const sections = [
  {
    title: "1. Who is responsible for your information",
    body: "SAIWAY is responsible for the personal information collected through this website and used to arrange your transfer. The final operator name, registered address and contact email should be inserted here before launch so customers can contact the correct Cambodian legal entity.",
  },
  {
    title: "2. Information we collect",
    body: "We may collect your name, email address, telephone number, booking reference, pickup and destination details, flight number, passenger count, luggage or accessibility requirements, payment status, messages and information needed to support your trip. We may also receive vehicle location or trip-status information from a driver or transport partner while a transfer is active.",
  },
  {
    title: "3. How we use information",
    body: "We use information to create and manage bookings, communicate confirmations and changes, coordinate drivers, provide live trip updates, process payments and refunds, respond to support requests, prevent fraud or misuse, maintain business records and comply with applicable Cambodian legal, tax, accounting and road-transport obligations. We do not sell passenger personal information.",
  },
  {
    title: "4. Sharing",
    body: "We share only the information reasonably needed with the assigned driver or transport partner, payment and technology providers, customer-support providers, insurers or professional advisers, and public authorities where required by law or necessary for safety. Service providers must use the information for the agreed service and protect it appropriately.",
  },
  {
    title: "5. Location and flight information",
    body: "If you provide a flight number, we may use it to estimate arrival and coordinate airport pickup. During an active trip, live location may be used to show driver status to the passenger and to support safety and dispatch. We do not present this information as a continuous location service outside the relevant booking unless you separately consent.",
  },
  {
    title: "6. Retention and security",
    body: "We keep booking and transaction records for as long as reasonably necessary for service delivery, customer support, accounting, dispute handling and applicable legal obligations. We use reasonable administrative and technical safeguards, but no online transmission or storage system can be guaranteed completely secure.",
  },
  {
    title: "7. Your choices and requests",
    body: "You may contact us to request access to, correction of or deletion of personal information, or to ask how it is being used. We may need to verify your identity and may retain information where required for a legal, safety, accounting or dispute-related purpose. Where a request is limited by applicable Cambodian law, we will explain the limitation.",
  },
  {
    title: "8. Cookies and third parties",
    body: "The website may use essential cookies or similar technologies needed for security, session handling and basic operation. If we add analytics, advertising or other non-essential technologies, we will provide appropriate notice and choices. Links to payment providers or other websites are governed by their own privacy notices.",
  },
  {
    title: "9. Contact and updates",
    body: "Contact SAIWAY using the details shown in your booking confirmation for privacy questions or requests. We may update this notice when our service, partners or legal obligations change. The latest version will be published on this page with its update date.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">Privacy Notice</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: 12 September 2026</p>
        <p className="mt-8 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 text-sm leading-6 text-[var(--color-text)]">This notice is a practical draft for SAIWAY&apos;s Cambodian service and should be reviewed by qualified Cambodian counsel before publication. Replace the operator placeholders with the final legal entity and contact details.</p>
        <div className="mt-8 space-y-8">
          {sections.map((section) => <section key={section.title}><h2 className="text-xl font-bold text-[var(--color-text)]">{section.title}</h2><p className="mt-3 leading-7 text-slate-600">{section.body}</p></section>)}
        </div>
      </div>
    </div>
  );
}
