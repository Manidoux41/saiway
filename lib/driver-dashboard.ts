import type { Course } from "../components/booking/course-dashboard";

export const driverTimeZone = "Asia/Phnom_Penh";
export const driverNextStatus: Record<string, string> = {
  DRIVER_ASSIGNED: "DRIVER_ACCEPTED",
  DRIVER_ACCEPTED: "DRIVER_EN_ROUTE",
  DRIVER_EN_ROUTE: "DRIVER_ARRIVED",
  DRIVER_ARRIVED: "TRIP_STARTED",
  TRIP_STARTED: "TRIP_COMPLETED",
};
export const closedDriverStatuses = ["TRIP_COMPLETED", "CANCELLED", "NO_SHOW", "REFUNDED"];
export type DriverTab = "today" | "upcoming" | "history";
export type Coordinates = [number, number];

export function driverDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: driverTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function filterDriverCourses(courses: Course[], tab: DriverTab, query = "", now = new Date()) {
  const search = query.trim().toLocaleLowerCase();
  return courses.filter((course) => {
    const isClosed = closedDriverStatuses.includes(course.status);
    const matchesTab = tab === "history" ? isClosed : !isClosed && (tab === "upcoming" || driverDay(course.pickupAt) === driverDay(now));
    return matchesTab && (!search || [course.reference, course.fromAddress, course.toAddress, course.customer.name, course.flightNumber ?? ""].join(" ").toLocaleLowerCase().includes(search));
  }).sort((first, second) => tab === "history" ? Date.parse(second.pickupAt) - Date.parse(first.pickupAt) : Date.parse(first.pickupAt) - Date.parse(second.pickupAt));
}

export function driverSummary(courses: Course[], now = new Date()) {
  const today = courses.filter((course) => driverDay(course.pickupAt) === driverDay(now));
  const active = today.filter((course) => !closedDriverStatuses.includes(course.status));
  const totals: Record<string, number> = {};
  for (const course of today.filter((course) => !["CANCELLED", "NO_SHOW", "REFUNDED"].includes(course.status))) {
    totals[course.currency] = (totals[course.currency] ?? 0) + course.priceCents;
  }
  return { remaining: active.length, completed: today.filter((course) => course.status === "TRIP_COMPLETED").length, passengers: active.reduce((sum, course) => sum + course.passengers, 0), totals };
}

export function navigationUrl(course: Pick<Course, "fromAddress" | "toAddress">) {
  const params = new URLSearchParams({ api: "1", origin: course.fromAddress, destination: course.toAddress, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${params}`;
}

export type ContactApp = "whatsapp" | "telegram";

// Returns an international number without "+" (Cambodian local numbers starting with 0 get +855).
export function internationalPhone(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = `855${digits.slice(1)}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function customerContact(course: Pick<Course, "contactPhone" | "customer">) {
  return internationalPhone(course.contactPhone) ?? internationalPhone(course.customer.phone);
}

export function contactLinks(phone: string, smsBody = "") {
  return {
    whatsapp: `https://wa.me/${phone}`,
    telegram: `https://t.me/+${phone}`,
    sms: `sms:+${phone}${smsBody ? `?body=${encodeURIComponent(smsBody)}` : ""}`,
    tel: `tel:+${phone}`,
  };
}

export const demoLocations: Record<string, Coordinates> = {
  "Siem Reap Angkor International Airport (SAI), Cambodia": [13.3692, 104.2231],
  "Raffles Grand Hotel d'Angkor, Siem Reap": [13.3643, 103.8597],
  "Park Hyatt Siem Reap, Cambodia": [13.3585, 103.8532],
  "Sofitel Angkor Phokeethra, Siem Reap": [13.3800, 103.8681],
};

export function createDemoCourses(user: { id: string; name: string }, now = new Date()): Course[] {
  const airport = "Siem Reap Angkor International Airport (SAI), Cambodia";
  const fixtures = [
    { from: airport, to: "Raffles Grand Hotel d'Angkor, Siem Reap", hours: 1, name: "Camille Martin", passengers: 2, luggage: 2, price: 3500, status: "DRIVER_ASSIGNED", flight: "K6 104", notes: "Arrival hall, exit A. Name sign: MARTIN.", needs: "" },
    { from: "Park Hyatt Siem Reap, Cambodia", to: airport, hours: 3, name: "James Wilson", passengers: 3, luggage: 3, price: 4000, status: "DRIVER_ACCEPTED", flight: "AK 541", notes: "Meet at the hotel lobby.", needs: "1 child seat / 1 siege enfant" },
    { from: airport, to: "Sofitel Angkor Phokeethra, Siem Reap", hours: 5, name: "Sophea Chan", passengers: 4, luggage: 4, price: 4500, status: "DRIVER_ASSIGNED", flight: "VN 837", notes: "Arrival hall, exit B. Name sign: CHAN.", needs: "" },
    { from: "Raffles Grand Hotel d'Angkor, Siem Reap", to: airport, hours: 25, name: "Alex Morgan", passengers: 1, luggage: 1, price: 3500, status: "DRIVER_ASSIGNED", flight: null, notes: "Hotel reception.", needs: "" },
    { from: airport, to: "Park Hyatt Siem Reap, Cambodia", hours: -2, name: "Emma Laurent", passengers: 2, luggage: 2, price: 3500, status: "TRIP_COMPLETED", flight: "QV 513", notes: "", needs: "" },
  ];
  return fixtures.map((fixture, index) => ({
    id: `demo-${user.id}-${index}`, reference: `DEMO-SW-${String(index + 1).padStart(3, "0")}`,
    fromAddress: fixture.from, toAddress: fixture.to,
    pickupAt: new Date(now.getTime() + fixture.hours * 3_600_000).toISOString(),
    passengers: fixture.passengers, luggageCount: fixture.luggage,
    direction: fixture.from === airport ? "AIRPORT_TO_CITY" : "CITY_TO_AIRPORT",
    tripType: "AIRPORT_TRANSFER", priceCents: fixture.price, currency: "USD", status: fixture.status,
    flightNumber: fixture.flight, pickupNotes: fixture.notes || null, specialNeeds: fixture.needs || null,
    driverId: `demo-driver-${user.id}`, vehicleId: "demo-vehicle",
    driver: { id: `demo-driver-${user.id}`, user: { name: user.name } },
    vehicle: { id: "demo-vehicle", name: "Toyota Hiace (demo)", plate: "DEMO-001", seats: 8 },
    customer: { id: `demo-customer-${index}`, name: fixture.name, email: `passenger-${index}@example.invalid` },
  }));
}