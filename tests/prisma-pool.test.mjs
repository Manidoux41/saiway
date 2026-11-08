import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/prisma.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;

for (const environment of ["production", "development"]) {
  test(`Prisma reuses one bounded pool across module evaluations in ${environment}`, () => {
    const adapters = [], clients = [];
    class PrismaPg { constructor(config) { this.config = config; adapters.push(this); } }
    class PrismaClient { constructor(config) { this.config = config; clients.push(this); } }
    const globalThis = {};
    function evaluate(env) {
      const exports = {};
      runInNewContext(compiled, {
        exports, globalThis, process: { env },
        require: (name) => {
          if (name === "@prisma/client") return { PrismaClient };
          if (name === "@prisma/adapter-pg") return { PrismaPg };
          throw new Error(`Unexpected import ${name}`);
        },
      });
      return exports.prisma;
    }
    const env = { NODE_ENV: environment, PRISMA_DATABASE_URL: "postgresql://pooled.invalid/test", DATABASE_URL: "postgresql://direct.invalid/test" };
    const first = evaluate(env), second = evaluate(env);
    assert.equal(first, second);
    assert.equal(clients.length, 1);
    assert.equal(adapters.length, 1);
    assert.equal(adapters[0].config.connectionString, env.PRISMA_DATABASE_URL);
    assert.equal(adapters[0].config.max, 2);
    assert.equal(adapters[0].config.connectionTimeoutMillis, 5000);
    assert.equal(adapters[0].config.idleTimeoutMillis, 5000);
    assert.equal(adapters[0].config.maxLifetimeSeconds, 60);
    assert.equal(adapters[0].config.application_name, "saiway-app");
  });
}

test("Prisma uses DATABASE_URL only when the application-specific URL is absent", () => {
  let config;
  const exports = {};
  runInNewContext(compiled, {
    exports, globalThis: {}, process: { env: { DATABASE_URL: "postgresql://fallback.invalid/test" } },
    require: (name) => name === "@prisma/client"
      ? { PrismaClient: class { constructor() {} } }
      : { PrismaPg: class { constructor(value) { config = value; } } },
  });
  assert.equal(config.connectionString, "postgresql://fallback.invalid/test");
});
