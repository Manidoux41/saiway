import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { approvedPaywayPayment, paywayHash, paywayRequestTime, purchaseFields, trustedCheckoutUrl, validPaywayCallback } from '../lib/payway.ts';

const config = { merchantId: 'test-merchant', apiKey: 'test-secret-not-a-real-key', origin: 'https://example.invalid', baseUrl: 'https://checkout-sandbox.payway.com.kh', provider: 'ABA_PAYWAY_SANDBOX', sandbox: true };
const payment = { id: '0123456789abcdef0123', bookingId: 'booking-test', amountCents: 3500, currency: 'USD' };
const approved = { status: { code: '00', tran_id: payment.id }, data: { payment_status_code: 0, payment_status: 'APPROVED', original_amount: 35, payment_amount: 35, payment_currency: 'USD', refund_amount: 0 } };

test('PayWay checkout signs documented fields in order and uses database amount', () => {
  const fields = purchaseFields(config, payment);
  const source = fields.req_time + config.merchantId + payment.id + '35.00' + 'purchase' + 'abapay_khqr_deeplink' + fields.return_url + fields.cancel_url + fields.continue_success_url + 'USD' + '15' + '1';
  assert.equal(fields.hash, createHmac('sha512', config.apiKey).update(source).digest('base64'));
  assert.equal(Buffer.from(fields.return_url, 'base64').toString(), 'https://example.invalid/api/payments/payway/callback');
  assert.equal(paywayRequestTime(new Date('2026-10-20T08:30:00Z')), '20261020083000');
  assert.throws(() => purchaseFields(config, { ...payment, amountCents: 0 }));
});

test('PayWay callback rejects modified, unsigned and malformed notifications', () => {
  const body = { tran_id: payment.id, status: '0', original_amount: 35 };
  const signature = paywayHash('35' + '0' + payment.id, config.apiKey);
  assert.equal(validPaywayCallback(body, signature, config.apiKey), true);
  assert.equal(validPaywayCallback({ ...body, original_amount: 1 }, signature, config.apiKey), false);
  assert.equal(validPaywayCallback(body, '', config.apiKey), false);
  assert.equal(validPaywayCallback({ ...body, injected: {} }, signature, config.apiKey), false);
});

test('only fully captured matching payments pass; holds, refunds and forged amounts fail', () => {
  assert.equal(approvedPaywayPayment(approved, payment), true);
  for (const changes of [{ payment_status: 'PRE-AUTH' }, { payment_status: 'PENDING' }, { payment_status_code: 2 }, { refund_amount: 1 }, { payment_currency: 'KHR' }, { original_amount: 1 }, { payment_amount: 1 }, { payment_amount: 35.004 }]) {
    assert.equal(approvedPaywayPayment({ ...approved, data: { ...approved.data, ...changes } }, payment), false);
  }
  assert.equal(approvedPaywayPayment({ ...approved, status: { code: '00', tran_id: 'different' } }, payment), false);
  assert.equal(approvedPaywayPayment({ status: 'paid' }, payment), false);
});

test('checkout URLs cannot redirect customers to arbitrary sites or mix environments', () => {
  assert.equal(trustedCheckoutUrl('https://checkout-sandbox.payway.com.kh/checkout/test', config), 'https://checkout-sandbox.payway.com.kh/checkout/test');
  for (const url of ['https://example.com', 'javascript:alert(1)', 'https://checkout.payway.com.kh/checkout/test', 'https://checkout-sandbox.payway.com.kh.evil.example']) assert.throws(() => trustedCheckoutUrl(url, config));
});