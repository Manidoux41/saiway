import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { localizedDate, localizedNumber } from '../lib/locale-format.ts';
import { legalCopy } from '../components/i18n/legal-copy.ts';
import { interfaceCopy } from '../components/i18n/interface-copy.ts';
import { bookingHistoryNote } from '../components/i18n/booking-history-note.ts';

test('generated booking history is localized without rewriting passenger observations or stored notes', () => {
  for (const language of ['en', 'fr', 'km']) {
    const t = key => interfaceCopy[language][key];
    const money = cents => localizedNumber(language, { style: 'currency', currency: 'USD' }).format(cents / 100);
    assert.equal(bookingHistoryNote('Booking created; payment is tracked separately', t, money), t('ui.noteCreated'));
    for (const [reason, key] of [
      ['zero GPS distance; original road estimate retained', 'ui.noteZeroGps'],
      ['driver confirmed road estimate', 'ui.noteEstimateConfirmed'],
      ['GPS distance', 'ui.noteGps'], ['agreed/package fare', 'ui.notePackage'],
    ]) {
      const note = `FARE_FINALIZED 375 -> 500 USD cents; ${reason}; Passenger requested a stop; សុខា`;
      assert.equal(bookingHistoryNote(note, t, money), `${t('ui.noteFinalized')}: ${money(375)} → ${money(500)}; ${t(key)}; Passenger requested a stop; សុខា`);
    }
    assert.equal(bookingHistoryNote('PRICE_ADJUSTMENT 375 -> 500 USD cents: User explanation', t, money), `${t('ui.notePriceAdjusted')}: ${money(375)} → ${money(500)}; User explanation`);
    assert.equal(bookingHistoryNote('DRIVER_AGREED: User explanation', t, money), `${t('ui.noteAgreed')}: User explanation`);
    assert.equal(bookingHistoryNote('Free-text English observation', t, money), 'Free-text English observation');
  }
});

test('Khmer dates and amounts remain localized when the browser lacks Khmer Intl data', (context) => {
  context.mock.method(Intl.DateTimeFormat, 'supportedLocalesOf', () => []);
  context.mock.method(Intl.NumberFormat, 'supportedLocalesOf', () => []);
  const value = new Date('2026-09-12T07:30:00Z');
  const result = localizedDate('km', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Phnom_Penh' }).format(value);
  assert.match(result, /កញ្ញា/);
  assert.match(result, /២០២៦/);
  assert.doesNotMatch(result, /[A-Za-z]/);
  assert.match(localizedDate('km', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Phnom_Penh' }).format(value), /សៅរ៍/);
  const narrow = localizedDate('km', { month: 'narrow', weekday: 'narrow', timeZone: 'UTC' }).format(new Date('2026-05-07T00:00:00Z'));
  assert.match(narrow, /ឧសភា/);
  assert.match(narrow, /ព្រហស្បតិ៍/);
  const withZone = localizedDate('km', { dateStyle: 'full', timeStyle: 'full', timeZone: 'Asia/Phnom_Penh' }).format(value);
  assert.doesNotMatch(withZone, /Indochina|September|Saturday/);
  assert.match(withZone, /GMT\+៧/);
  assert.match(localizedNumber('km', { style: 'currency', currency: 'USD' }).format(3.75), /៣[.,]៧៥/);
  assert.equal(localizedDate('fr', { dateStyle: 'long', timeZone: 'UTC' }).format(value), new Intl.DateTimeFormat('fr', { dateStyle: 'long', timeZone: 'UTC' }).format(value));
});

test('French and Khmer legal pages preserve every English section, paragraph and cancellation rule', () => {
  function sections(path, name) {
    const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let result;
    function walk(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && ts.isArrayLiteralExpression(node.initializer)) result = node.initializer.elements;
      ts.forEachChild(node, walk);
    }
    walk(source);
    assert.ok(result, `${path}: ${name} missing`);
    return result;
  }
  const terms = sections('app/terms/page.tsx', 'sections');
  const privacy = sections('app/privacy/page.tsx', 'sections');
  const rules = sections('app/cancellation-policy/page.tsx', 'rules');
  for (const language of ['fr', 'km']) {
    const copy = legalCopy[language];
    assert.equal(copy.terms.sections.length, terms.length);
    assert.equal(copy.privacy.sections.length, privacy.length);
    assert.equal(copy.cancellation.rules.length, rules.length);
    assert.equal(copy.cancellation.sections.length, 5);
    terms.forEach((section, index) => {
      const paragraphs = section.properties.find(property => property.name?.getText() === 'paragraphs').initializer.elements;
      assert.equal(copy.terms.sections[index].paragraphs.length, paragraphs.length);
    });
    const strings = [];
    function collect(value) {
      if (typeof value === 'string') strings.push(value);
      else Object.values(value).forEach(collect);
    }
    collect(copy);
    assert.ok(strings.every(value => value.trim().length > 0));
    if (language === 'km') assert.ok(strings.every(value => /[\u1780-\u17ff]/.test(value)));
  }
});
