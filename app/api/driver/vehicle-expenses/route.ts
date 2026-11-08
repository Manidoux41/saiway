import { listDriverVehicleExpenses, submitDriverFuelExpense, vehicleExpenseResponse } from "@/lib/vehicle-expenses";
export const runtime = "nodejs";
export const GET = (request: Request) => vehicleExpenseResponse(() => listDriverVehicleExpenses(request), "Driver vehicle expenses")();
export const POST = (request: Request) => vehicleExpenseResponse(() => submitDriverFuelExpense(request), "Fuel submission", 201)();
