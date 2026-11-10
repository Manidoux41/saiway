import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/list-sort.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { sortList, sortDate } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const field = (key) => ({ key, label: key, value: (item) => item[key] });

test("list sorting compares numeric amounts and dates in both directions without mutating input", () => {
  const items = Object.freeze([
    { id: "a", amount: 100, date: "2026-11-01T00:00:00+07:00" },
    { id: "b", amount: 9, date: "2026-10-31T18:00:00Z" },
    { id: "c", amount: 20, date: "2026-11-02T00:00:00Z" },
  ]);
  assert.deepEqual(sortList(items, field("amount"), "asc", "fr").map((x) => x.id), ["b", "c", "a"]);
  assert.deepEqual(sortList(items, field("amount"), "desc", "fr").map((x) => x.id), ["a", "c", "b"]);
  const date = { key: "date", label: "Date", value: (item) => sortDate(item.date) };
  assert.deepEqual(sortList(items, date, "asc", "fr").map((x) => x.id), ["a", "b", "c"]);
  assert.deepEqual(sortList(items, date, "desc", "fr").map((x) => x.id), ["c", "b", "a"]);
  assert.deepEqual(items.map((x) => x.id), ["a", "b", "c"]);
});

test("empty or invalid dates stay last in both directions and ties retain their order", () => {
  const items = [
    { id: "missing", date: null }, { id: "a", date: "2026-01-01" },
    { id: "invalid", date: "bad" }, { id: "b", date: "2026-01-01" },
    { id: "empty", date: "" }, { id: "new", date: "2027-01-01" },
  ];
  const date = { key: "date", label: "Date", value: (item) => sortDate(item.date) };
  assert.deepEqual(sortList(items, date, "asc", "fr").map((x) => x.id), ["a", "b", "new", "missing", "invalid", "empty"]);
  assert.deepEqual(sortList(items, date, "desc", "fr").map((x) => x.id), ["new", "a", "b", "missing", "invalid", "empty"]);
  assert.deepEqual(sortList([], date, "asc", "fr"), []);
});

test("names, categories and statuses use localized natural ordering for English, French and Khmer", () => {
  const items = [{ name: "Véhicule 10" }, { name: "véhicule 2" }, { name: "Angkor" }];
  for (const locale of ["fr", "en", "km"]) {
    assert.deepEqual(sortList(items, field("name"), "asc", locale).map((x) => x.name), ["Angkor", "véhicule 2", "Véhicule 10"]);
    assert.deepEqual(sortList(items, field("name"), "desc", locale).map((x) => x.name), ["Véhicule 10", "véhicule 2", "Angkor"]);
    const statuses = ["En cours", "Annulé", "Terminé"];
    const expected = [...statuses].sort(new Intl.Collator(locale, { numeric: true, sensitivity: "base" }).compare);
    assert.deepEqual(sortList(statuses, { key: "status", label: "Status", value: (x) => x }, "asc", locale), expected);
  }
});
