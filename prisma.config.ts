import nextEnv from "@next/env";
import { defineConfig, env } from "prisma/config";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
