import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../lib/accounting-policy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { ledgerRows, accountingMonth, accountingBalance, contractPeriod } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('accounting deduplicates linked trip payments, separates currencies and credits, and uses Phnom Penh month boundaries', () => {
  const date = '2026-10-31T17:00:00.000Z';
  const entry = { id: 'entry', type: 'REVENUE', category: 'TRIP', label: 'trip', amountCents: 1000, currency: 'USD', entryDate: date, paidAt: date, sourceKey: 'payment:p1', vehicleId: null };
  const receipt = { id: 'p1', amountCents: 1000, currency: 'USD', confirmedAt: date, updatedAt: '2026-12-02T00:00:00.000Z', booking: { reference: 'trip', vehicleId: null } };
  const rows = ledgerRows({ entries: [entry, { ...entry, id: 'fuel', type: 'EXPENSE', amountCents: 200, category: 'FUEL', sourceKey: 'vehicle-expense:e1' }, { ...entry, id: 'loan', type: 'CREDIT', sourceKey: null, amountCents: 5000 }, { ...entry, id: 'khr', sourceKey: null, currency: 'KHR', amountCents: 4000000 }, { ...entry, id: 'pending', type: 'EXPENSE', sourceKey: null, amountCents: 100, paidAt: null }], receipts: [receipt] });
  assert.equal(rows.length, 5);
  assert.equal(accountingMonth(date), '2026-11');
  assert.equal(accountingMonth('2026-10-31T16:59:59.999Z'), '2026-10');
  assert.deepEqual(accountingBalance(rows), { revenue: 1000, expense: 300, balance: 700, cashBalance: 800, credits: 5000 });
  assert.equal(accountingBalance(rows, 'KHR').revenue, 4000000);
  const legacy = ledgerRows({ entries: [], receipts: [{ ...receipt, confirmedAt: null }] });
  assert.equal(legacy[0].historicalDate, true);
  assert.equal(legacy[0].date, receipt.updatedAt);
  assert.equal(ledgerRows({ entries: [{ ...entry, deletedAt: date }], receipts: [receipt] }).length, 0, 'Deleted payment entries must not fall back to their receipt');
});

test('vehicle contract periods include historical, current and future dates', () => {
  const now = Date.parse('2026-11-10T00:00:00Z');
  const contract = { status: 'ACTIVE', startsAt: '2026-01-01T00:00:00Z', endsAt: null };
  assert.equal(contractPeriod(contract, now), 'CURRENT');
  assert.equal(contractPeriod({ ...contract, startsAt: '2027-01-01T00:00:00Z' }, now), 'UPCOMING');
  assert.equal(contractPeriod({ ...contract, endsAt: '2026-02-01T00:00:00Z' }, now), 'PAST');
  assert.equal(contractPeriod({ ...contract, status: 'INACTIVE' }, now), 'PAST');
});
