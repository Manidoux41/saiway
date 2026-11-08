import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL("../components/layout/dashboard-menu.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports = {};
runInNewContext(source, { exports, require: (name) => name === "@/components/i18n/language-provider" ? { useLanguage: () => ({ t: () => "Workspace menu" }) } : require(name) });
const { DashboardSection, DashboardMenu, DashboardWorkspace } = exports;

test("dashboard sections are initially collapsed and retain child forms in the DOM", () => {
  const html = renderToStaticMarkup(React.createElement(DashboardSection, { id: "fuel", title: "Fuel log" }, React.createElement("input", { name: "litres", defaultValue: "20" })));
  assert.match(html, /<details id="fuel"/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /<summary[^>]*>.*Fuel log/);
  assert.match(html, /name="litres" value="20"/);
  assert.doesNotMatch(html, /aria-expanded/);
});

test("dashboard menu renders grouped native disclosures and semantic destination links", () => {
  const html = renderToStaticMarkup(React.createElement(DashboardMenu, {
    groups: [{ title: "Vehicles", items: [{ title: "Fleet", target: "fleet" }] }, { title: "Finance", items: [{ title: "Fuel", target: "fuel" }, { title: "Payroll", target: "payroll" }] }],
  }));
  assert.match(html, /<nav aria-label="Workspace menu"/);
  assert.equal((html.match(/<details/g) || []).length, 2);
  for (const target of ["fleet", "fuel", "payroll"]) assert.ok(html.includes(`href="#${target}"`));
  assert.doesNotMatch(html, /role="menu"/);
});

test("workspace has a responsive sidebar and an accessible initially closed mobile toggle", () => {
  const html = renderToStaticMarkup(React.createElement(DashboardWorkspace, {
    menu: React.createElement("nav", null, "Tools"),
  }, React.createElement("form", null, React.createElement("input", { defaultValue: "Draft" }))));
  assert.match(html, /<aside/);
  assert.match(html, /aria-expanded="false"/);
  const controlledId = html.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(controlledId);
  assert.ok(html.includes(`id="${controlledId}"`));
  assert.match(html, /class="hidden xl:block"/);
  assert.match(html, /xl:sticky/);
  assert.match(html, /value="Draft"/);
});
