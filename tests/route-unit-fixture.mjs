import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
export function routeFixture(path, dependencies) {
  const filename = new URL(`../${path}`, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Request, Response, URL, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
  }, { filename: filename.pathname });
  return exports;
}
export function jsonRequest(path, body, method = 'POST') {
  return new Request(`https://saiway.example${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
