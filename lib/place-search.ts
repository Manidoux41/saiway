import { z } from "zod";

export const geocodingUrl = process.env.NEXT_PUBLIC_GEOCODING_URL || "https://photon.komoot.io/api/";
const featureSchema = z.object({
  features: z.array(z.object({
    geometry: z.object({ coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]) }),
    properties: z.object({
      name: z.string().optional(), street: z.string().optional(), housenumber: z.string().optional(),
      city: z.string().optional(), state: z.string().optional(), country: z.string().optional(),
    }),
  })),
});

export async function searchPlaces(query: string, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: "6", lat: "13.36", lon: "103.85" });
  const response = await fetch(`${geocodingUrl}${geocodingUrl.includes("?") ? "&" : "?"}${params}`, { signal });
  if (!response.ok) throw new Error("Place search unavailable");
  const data = featureSchema.parse(await response.json());
  return data.features.map(({ properties: p, geometry }) => {
    const name = p.name || [p.housenumber, p.street].filter(Boolean).join(" ") || p.city || p.state || p.country;
    const detail = [...new Set([p.street, p.city, p.state, p.country].filter((part) => part && part !== name))].join(", ");
    return { name: name || query, detail, latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] };
  });
}
