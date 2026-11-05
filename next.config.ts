import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/admin/contracts/\\[contractId\\]/pdf": ["./assets/fonts/**/*"],
    "/api/admin/drivers/\\[driverId\\]/business-card": ["./assets/fonts/**/*"],
    "/api/admin/business-cards": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
