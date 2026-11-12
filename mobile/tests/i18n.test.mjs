import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { translations } from '../src/lib/translations.ts';
import { changeLanguage, formatDateTime, formatHistoryNote, formatMoney, getLanguage, isLanguage, subscribeLanguage, t, translate } from '../src/lib/i18n.ts';

const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('every mobile message has complete English and Khmer translations with identical parameters', () => {
  for (const [source, [en, km]] of Object.entries(translations)) {
    assert.ok(en.trim(), `Missing English: ${source}`);
    assert.ok(km.trim(), `Missing Khmer: ${source}`);
    assert.deepEqual(parameters(en), parameters(source), `English parameters: ${source}`);
    assert.deepEqual(parameters(km), parameters(source), `Khmer parameters: ${source}`);
    assert.ok(/[\u1780-\u17ff]/u.test(km) || km === 'GPS', `Expected Khmer script: ${source}`);
    const values = Object.fromEntries(parameters(source).map(key => [key, 'TEST']));
    for (const locale of ['fr', 'en', 'km']) assert.doesNotMatch(translate(source, locale, values), /\{p\d+\}/);
  }
});

test('language changes update subscribers, support all roles and leave user/server content untouched', () => {
  let notifications = 0;
  const unsubscribe = subscribeLanguage(() => notifications++);
  for (const locale of ['en', 'km', 'fr']) {
    assert.ok(isLanguage(locale));
    changeLanguage(locale);
    assert.equal(getLanguage(), locale);
    for (const source of ['Réserver un trajet', 'Votre service', 'Un chauffeur, maintenant', 'Informations légales']) {
      assert.equal(t(source), translate(source, locale));
      if (locale !== 'fr') assert.notEqual(t(source), source);
    }
    assert.equal(t('Hotel {private-data}'), 'Hotel {private-data}');
  }
  unsubscribe();
  assert.equal(notifications, 3);
  assert.equal(isLanguage('de'), false);
  assert.throws(() => translate('Bonjour {p0}.', 'km'), /Missing translation parameter/);
  assert.equal(translate('Bonjour {p0}.', 'en', { p0: 'Sokha' }), 'Hello Sokha.');
});

test('known API errors and business enums are translated without changing protocol values', () => {
  assert.equal(translate('Invalid credentials', 'fr'), 'Email ou mot de passe incorrect.');
  assert.equal(translate('Invalid credentials', 'en'), 'Invalid email or password.');
  assert.match(translate('Driver access required', 'km'), /[\u1780-\u17ff]/u);
  assert.equal(translate('PRO_APPROVAL_REQUIRED', 'en'), 'Your account must be approved before booking.');
  assert.equal(translate('APPROVED', 'en'), 'Approved');
  assert.equal(translate('SMALL', 'fr'), 'Petit circuit');
  assert.equal(translate('GPS_INCOMPLETE_CONFIRM_ROUTE', 'en'), 'GPS_INCOMPLETE_CONFIRM_ROUTE');
});

test('dates remain in Cambodia and money uses the chosen locale', () => {
  for (const [locale, intl] of [['fr', 'fr-FR'], ['en', 'en-US'], ['km', 'km-KH']]) {
    assert.equal(formatMoney(12345, 'USD', locale), new Intl.NumberFormat(intl, { style: 'currency', currency: 'USD' }).format(123.45));
    assert.equal(formatDateTime('2026-11-10T20:00:00Z', locale), new Intl.DateTimeFormat(intl, {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Phnom_Penh',
    }).format(new Date('2026-11-10T20:00:00Z')));
  }
});

test('generated history is localized while passenger notes and price reasons are preserved', () => {
  const source = 'Booking created; payment is tracked separately';
  assert.notEqual(formatHistoryNote(source, 'km'), source);
  assert.notEqual(formatHistoryNote(source, 'fr'), source);
  assert.equal(formatHistoryNote('Passenger note {hotel-name}', 'km'), 'Passenger note {hotel-name}');
  assert.match(formatHistoryNote('DRIVER_AGREED: Passenger requested a stop', 'km'), /Passenger requested a stop$/);
});

test('Khmer formats do not fall back to English on runtimes without Khmer Intl data', context => {
  context.mock.method(Intl.DateTimeFormat, 'supportedLocalesOf', () => []);
  context.mock.method(Intl.NumberFormat, 'supportedLocalesOf', () => []);
  assert.match(formatDateTime('2026-11-10T20:00:00Z', 'km'), /វិច្ឆិកា/);
  assert.match(formatMoney(12345, 'USD', 'km'), /១២៣[.,]៤៥/);
});

test('all static translation calls are catalogued and active screens have no untranslated UI literals', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url));
  const brands = new Set(['SAIWAY', 'TRANSFER', 'SAIWAY / SIEM REAP', 'SAIWAY Transfer', 'WhatsApp', 'Telegram']);
  const active = name => name.startsWith('app/') ||
    /^components\/(native-ui|address-field|advertising-popup|driver-duty|private-image|route-map|brand|language-selector|notification-settings|account-deletion)/.test(name);
  for (const name of readdirSync(root, { recursive: true }).filter(name => /\.[jt]sx?$/.test(name))) {
    if (/^(lib\/(?:i18n|translations|shared\/)|providers\/language)/.test(name)) continue;
    const text = readFileSync(path.join(root, name), 'utf8');
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        assert.ok(Object.hasOwn(translations, node.arguments[0].text), `${name}: missing ${node.arguments[0].text}`);
      }
      if (active(name) && ts.isJsxText(node)) {
        const literal = node.text.replace(/\s+/g, ' ').trim();
        assert.ok(!/\p{L}/u.test(literal) || brands.has(literal), `${name}: untranslated JSX text ${literal}`);
      }
      if (active(name) && ts.isJsxAttribute(node) && /^(title|subtitle|label|placeholder|accessibilityLabel)$/.test(node.name.getText(source)) &&
        node.initializer && ts.isStringLiteral(node.initializer)) {
        assert.ok(brands.has(node.initializer.text), `${name}: untranslated attribute ${node.initializer.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
