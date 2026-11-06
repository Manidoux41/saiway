import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCache = new Map();
const unresolved = Symbol("unresolved");
const acronymOnly = new Set(["ABA"]);

function readSource(file) {
  const resolved = path.resolve(file);
  if (!sourceCache.has(resolved)) {
    const text = fs.readFileSync(resolved, "utf8");
    sourceCache.set(resolved, ts.createSourceFile(resolved, text, ts.ScriptTarget.Latest, true, resolved.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  }
  return sourceCache.get(resolved);
}

function modulePath(fromFile, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return undefined;
  const base = specifier.startsWith("@/")
    ? path.resolve(root, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromFile}`);
}

function declarationsIn(file) {
  const source = readSource(file);
  const variables = new Map();
  const imports = new Map();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) variables.set(declaration.name.text, declaration.initializer);
      }
    } else if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const importedFile = modulePath(file, statement.moduleSpecifier.text);
      if (!importedFile) continue;
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements) imports.set(item.name.text, { file: importedFile, name: (item.propertyName ?? item.name).text });
      }
    }
  }
  return { variables, imports };
}

function unwrap(expression) {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    expression = expression.expression;
  }
  return expression;
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) return name.expression.text;
  return undefined;
}

function evaluate(expression, file, stack = new Set()) {
  expression = unwrap(expression);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.map((element) => evaluate(element, file, stack));
  if (ts.isObjectLiteralExpression(expression)) {
    const result = {};
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = evaluate(property.expression, file, stack);
        if (spread && typeof spread === "object") Object.assign(result, spread);
      } else if (ts.isPropertyAssignment(property)) {
        const key = propertyName(property.name);
        if (key !== undefined) result[key] = evaluate(property.initializer, file, stack);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        result[property.name.text] = evaluate(property.name, file, stack);
      }
    }
    return result;
  }
  if (ts.isIdentifier(expression)) {
    const { variables, imports } = declarationsIn(file);
    if (imports.has(expression.text)) {
      const imported = imports.get(expression.text);
      return evaluateExport(imported.file, imported.name, stack);
    }
    if (!variables.has(expression.text)) return unresolved;
    const marker = `${file}:${expression.text}`;
    if (stack.has(marker)) throw new Error(`Circular translation reference: ${marker}`);
    const nextStack = new Set(stack);
    nextStack.add(marker);
    return evaluate(variables.get(expression.text), file, nextStack);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const object = evaluate(expression.expression, file, stack);
    return object !== unresolved && object != null ? object[expression.name.text] ?? unresolved : unresolved;
  }
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const object = evaluate(expression.expression, file, stack);
    const key = evaluate(expression.argumentExpression, file, stack);
    return object !== unresolved && object != null && typeof key === "string" ? object[key] ?? unresolved : unresolved;
  }
  return unresolved;
}

function evaluateExport(file, name, stack = new Set()) {
  const { variables } = declarationsIn(file);
  if (!variables.has(name)) throw new Error(`Missing export ${name} in ${file}`);
  return evaluate(variables.get(name), file, stack);
}

function findVariable(file, name) {
  const { variables } = declarationsIn(file);
  assert.ok(variables.has(name), `Expected ${name} in ${file}`);
  return evaluate(variables.get(name), file);
}

function dictionaryValues(dictionary, label) {
  assert.ok(dictionary && typeof dictionary === "object", `${label} must resolve to an object`);
  for (const [key, value] of Object.entries(dictionary)) {
    assert.equal(typeof value, "string", `${label}.${key} must resolve to a string`);
    assert.ok(value.trim(), `${label}.${key} must not be empty`);
  }
  return dictionary;
}

const operationalDictionaries = [
  "driver-copy.ts",
  "admin-copy.ts",
  "customer-copy.ts",
  "profile-copy.ts",
  "tracking-copy.ts",
  "place-copy.ts",
  "fare-copy.ts",
];

test("operational dictionaries have complete, nonempty EN/FR/KM translations", () => {
  for (const fileName of operationalDictionaries) {
    const file = path.join(root, "components/i18n", fileName);
    const match = fileName.match(/^([a-z]+)-copy\.ts$/);
    const copy = evaluateExport(file, `${match[1]}Copy`);
    const en = dictionaryValues(copy.en, `${fileName}.en`);
    const fr = dictionaryValues(copy.fr, `${fileName}.fr`);
    const km = dictionaryValues(copy.km, `${fileName}.km`);
    assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), `${fileName} French keys must match English`);
    assert.deepEqual(Object.keys(km).sort(), Object.keys(en).sort(), `${fileName} Khmer keys must match English`);
    for (const [key, value] of Object.entries(km)) {
      assert.ok(/[\u1780-\u17ff]/u.test(value) || acronymOnly.has(value), `${fileName}.km.${key} needs Khmer text`);
    }
  }
});

test("operations composes each operational Khmer dictionary and keeps locale keys aligned", () => {
  const file = path.join(root, "components/i18n/operations.ts");
  const operations = evaluateExport(file, "operations");
  for (const locale of ["en", "fr", "km"]) dictionaryValues(operations[locale], `operations.${locale}`);
  const keys = Object.keys(operations.en).sort();
  assert.deepEqual(Object.keys(operations.fr).sort(), keys, "French operations keys must match English");
  assert.deepEqual(Object.keys(operations.km).sort(), keys, "Khmer operations keys must match English");
  for (const [moduleName, exportName] of [
    ["driver-copy.ts", "driverCopy"],
    ["admin-copy.ts", "adminCopy"],
    ["customer-copy.ts", "customerCopy"],
    ["profile-copy.ts", "profileCopy"],
    ["tracking-copy.ts", "trackingCopy"],
    ["place-copy.ts", "placeCopy"],
    ["fare-copy.ts", "fareCopy"],
    ["autonomous-copy.ts", "autonomousCopy"],
    ["interface-copy.ts", "interfaceCopy"],
    ["push-copy.ts", "pushCopy"],
  ]) {
    const copy = evaluateExport(path.join(root, "components/i18n", moduleName), exportName);
    for (const locale of ["en", "fr", "km"]) {
      for (const key of Object.keys(copy[locale])) {
        assert.ok(Object.hasOwn(operations[locale], key), `operations.${locale} must include ${moduleName}.${locale}.${key}`);
      }
    }
  }
  for (const [key, value] of Object.entries(operations.km)) {
    assert.ok(/[\u1780-\u17ff]/u.test(value) || acronymOnly.has(value), `operations.km.${key} needs Khmer text`);
  }
});

test("language provider merges complete translations without hiding missing dictionary keys", () => {
  const file = path.join(root, "components/i18n/language-provider.tsx");
  const translations = findVariable(file, "translations");
  const locales = Object.keys(translations);
  assert.deepEqual(locales.sort(), ["en", "fr", "km"]);
  const keys = Object.keys(dictionaryValues(translations.en, "language-provider.en")).sort();
  assert.deepEqual(Object.keys(dictionaryValues(translations.fr, "language-provider.fr")).sort(), keys, "French provider keys must match English");
  assert.deepEqual(Object.keys(dictionaryValues(translations.km, "language-provider.km")).sort(), keys, "Khmer provider keys must match English");
  const operations = evaluateExport(path.join(root, "components/i18n/operations.ts"), "operations");
  for (const locale of locales) {
    for (const key of Object.keys(operations[locale])) {
      assert.ok(Object.hasOwn(translations[locale], key), `language-provider.${locale} must include operations.${locale}.${key}`);
    }
  }
  for (const [key, value] of Object.entries(translations.km)) {
    assert.ok(/[\u1780-\u17ff]/u.test(value) || acronymOnly.has(value), `language-provider.km.${key} needs Khmer text`);
  }
});

function translationShape(value, label) {
  if (typeof value === "string") {
    assert.ok(value.trim(), `${label} must not be empty`);
    return "string";
  }
  if (Array.isArray(value)) return value.map((item, index) => translationShape(item, `${label}[${index}]`));
  assert.ok(value && typeof value === "object", `${label} must contain only strings, arrays, or objects`);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, translationShape(value[key], `${label}.${key}`)]));
}

test("legal copy has matching French and Khmer nested sections without requiring English", () => {
  const legalFile = path.join(root, "components/i18n/legal-copy.ts");
  const legal = evaluateExport(legalFile, "legalCopy");
  assert.deepEqual(Object.keys(legal).sort(), ["fr", "km"]);
  const frShape = translationShape(legal.fr, "legal-copy.fr");
  const kmShape = translationShape(legal.km, "legal-copy.km");
  assert.deepEqual(kmShape, frShape, "French and Khmer legal sections must have the same nested shape");
});

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [file] : [];
  });
}

test("static t(string) calls refer to keys in the merged language provider", () => {
  const translations = findVariable(path.join(root, "components/i18n/language-provider.tsx"), "translations");
  const known = new Set(Object.keys(translations.en));
  const unknown = [];
  for (const directory of ["app", "components"]) {
    for (const file of sourceFiles(path.join(root, directory))) {
      const source = readSource(file);
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t" && node.arguments.length) {
          function collect(expression) {
            expression = unwrap(expression);
            if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
              const key = expression.text;
              if (!known.has(key)) unknown.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(expression.getStart(source)).line + 1}: ${key}`);
            } else if (ts.isConditionalExpression(expression)) {
              collect(expression.whenTrue);
              collect(expression.whenFalse);
            } else if (ts.isBinaryExpression(expression)) {
              collect(expression.left);
              collect(expression.right);
            }
          }
          collect(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  assert.deepEqual(unknown, [], `Unknown static translation keys:\n${unknown.join("\n")}`);
});
