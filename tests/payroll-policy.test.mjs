import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../lib/payroll-policy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { payrollPeriod, proratedSalary, payrollAmounts } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('payroll covers complete months, pays on next-month 26 and prorates calendar days with exact 80 percent commission', () => {
  assert.equal(payrollPeriod('2024-02').days, 29);
  assert.equal(payrollPeriod('2026-02').days, 28);
  assert.equal(payrollPeriod('2026-10').days, 31);
  assert.equal(payrollPeriod('2026-12').scheduledPayAt.toISOString(), '2027-01-25T17:00:00.000Z');
  assert.equal(proratedSalary('2026-10', [{ startsAt: new Date('2026-10-15T00:00:00Z'), terminatedAt: null, monthlySalaryCents: 31000 }]).total, 17000);
  assert.equal(proratedSalary('2024-02', [{ startsAt: new Date('2024-02-01T00:00:00Z'), terminatedAt: new Date('2024-02-29T00:00:00Z'), monthlySalaryCents: 29000 }]).total, 29000);
  assert.deepEqual(payrollAmounts(17000, 9000, 500, 100), { commission: 7200, net: 24600 });
  assert.throws(() => payrollAmounts(100, 0, 0, 101));
  assert.throws(() => payrollAmounts(2_147_483_647, 100, 0, 100));
  assert.throws(() => payrollPeriod('2026-13'));
  assert.throws(() => proratedSalary('2026-10', [1, 2].map(() => ({ startsAt: new Date('2026-10-01'), terminatedAt: null, monthlySalaryCents: 31000 }))));
});
