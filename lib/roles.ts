export type UserRole = "customer" | "driver" | "admin";

export function roleHome(role: UserRole | "CUSTOMER" | "DRIVER" | "ADMIN") {
  if (role === "ADMIN" || role === "admin") return "/admin";
  if (role === "DRIVER" || role === "driver") return "/driver";
  return "/account";
}
