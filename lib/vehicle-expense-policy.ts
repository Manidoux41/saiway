export type ExpenseCurrency = "USD" | "KHR";

const centsPerDollar = BigInt(100);
const khrRateScale = BigInt(10_000);
const maximumDatabaseInt = BigInt(2_147_483_647);

export function fixedDecimal(value: unknown, precision: number, maximumScaled: bigint, positive: boolean) {
  if (typeof value !== "string") return null;
  const expression = precision === 0
    ? /^(?:0|[1-9]\d*)$/
    : new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${precision}})?$`);
  if (!expression.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const scale = BigInt(10) ** BigInt(precision);
  const scaled = BigInt(whole) * scale + BigInt(fraction.padEnd(precision, "0") || "0");
  if ((positive && scaled <= BigInt(0)) || scaled > maximumScaled) return null;
  return scaled;
}

export function formatFixedDecimal(scaled: bigint, precision: number) {
  if (!precision) return scaled.toString();
  const scale = BigInt(10) ** BigInt(precision);
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(precision, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function parseAmountInput(value: string, currency: ExpenseCurrency) {
  const precision = currency === "USD" ? 2 : 0;
  const scaled = fixedDecimal(value, precision, maximumDatabaseInt, true);
  return scaled === null ? null : Number(scaled);
}

export function convertedUsdCents(amountCents: number, currency: ExpenseCurrency, rate: string | null | undefined) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > Number(maximumDatabaseInt)) return null;
  if (currency === "USD") return rate == null ? amountCents : null;
  const scaledRate = fixedDecimal(rate, 4, BigInt(999_999_999_999), true);
  if (scaledRate === null) return null;
  const numerator = BigInt(amountCents) * centsPerDollar * khrRateScale;
  const converted = (numerator + scaledRate / BigInt(2)) / scaledRate;
  if (converted <= BigInt(0) || converted > maximumDatabaseInt) return null;
  return Number(converted);
}

export function parseOccurredAt(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", , offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1900 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return null;
  if (offset !== "Z") {
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMinutes = Number(offset.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function odometerOrderConflict(
  existing: Array<{ occurredAt: Date; odometerKm: string }>,
  next: { occurredAt: Date; odometerKm: string },
) {
  const candidate = fixedDecimal(next.odometerKm, 1, BigInt(999_999_999_999), false);
  if (candidate === null) return true;
  return existing.some((record) => {
    const previous = fixedDecimal(record.odometerKm, 1, BigInt(999_999_999_999), false);
    if (previous === null) return true;
    if (record.occurredAt.getTime() < next.occurredAt.getTime()) return previous > candidate;
    if (record.occurredAt.getTime() > next.occurredAt.getTime()) return previous < candidate;
    return previous !== candidate;
  });
}
