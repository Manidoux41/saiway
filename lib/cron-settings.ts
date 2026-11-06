export const gpsRetentionSettingKey = "gpsRetentionEnabled";

export function gpsRetentionEnabled(value: string | null | undefined): boolean {
  if (value == null || value === "true") return true;
  if (value === "false") return false;
  throw new Error("Invalid GPS retention setting");
}
