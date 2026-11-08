import { getAdminVehicleExpenses, reviewAdminVehicleExpense, submitAdminMaintenanceExpense, vehicleExpenseResponse } from "@/lib/vehicle-expenses";
export const runtime = "nodejs";
export const GET = (request: Request) => vehicleExpenseResponse(() => getAdminVehicleExpenses(request), "Admin vehicle expenses")();
export const POST = (request: Request) => vehicleExpenseResponse(() => submitAdminMaintenanceExpense(request), "Maintenance submission", 201)();
export const PATCH = (request: Request) => vehicleExpenseResponse(() => reviewAdminVehicleExpense(request), "Vehicle expense review")();
