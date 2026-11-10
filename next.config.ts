import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit", "web-push"],
  outputFileTracingIncludes: {
    "/api/admin/advertising/\\[contractId\\]/pdf": ["./assets/fonts/**/*"],
    "/api/admin/contracts/\\[contractId\\]/pdf": ["./assets/fonts/**/*"],
    "/api/admin/drivers/\\[driverId\\]/business-card": ["./assets/fonts/**/*"],
    "/api/admin/business-cards": ["./assets/fonts/**/*"],
    "/api/admin/payroll/\\[payrollId\\]/pdf": ["./assets/fonts/**/*"],
    "/api/driver/payroll/\\[payrollId\\]/pdf": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
