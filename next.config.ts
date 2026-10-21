import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/api/admin/contracts/\\[contractId\\]/pdf": ["./assets/fonts/**/*"] },
};

export default nextConfig;
