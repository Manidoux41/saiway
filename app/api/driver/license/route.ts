import { driverLicenseSummary, uploadDriverLicense } from "@/lib/driver-license";

export const runtime = "nodejs";
export const GET = driverLicenseSummary;
export const POST = uploadDriverLicense;
