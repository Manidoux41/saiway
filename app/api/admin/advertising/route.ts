import { listAdvertising, mutateAdvertising } from "@/lib/advertising";

export const runtime = "nodejs";
export const GET = listAdvertising;
export const POST = (request: Request) => mutateAdvertising(request);
