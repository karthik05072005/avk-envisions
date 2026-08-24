import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY_SECRET = 'test_secret_do_not_use';
const WEBHOOK_SECRET = 'test_webhook_secret';

// The service reads secrets through serverEnv(), so stub that rather than the
// process environment — it validates and caches on first use.
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    INVOICE_SERIES_PREFIX: 'AVK',
  }),
}));

vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/services/pricing-service', () => ({ getSeriesPricing: async () => null }));

const { verifyCheckoutSignature, verifyWebhookSignature } = await import('./payment-service');

describe('verifyCheckoutSignature', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';

  const sign = (secret: string) =>
    createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  it('accepts a signature produced with the API secret', () => {
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: sign(KEY_SECRET),
      }),
    ).toBe(true);
  });

  it('rejects one signed with the wrong secret', () => {
    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: sign('attacker_guess'),
      }),
    ).toBe(false);
  });

  it('rejects a signature lifted from a different payment', () => {
    // A real signature, replayed against another payment id, must not pass —
    // otherwise one genuine purchase would unlock every later order.
    const stolen = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|pay_SOMEONE_ELSE`)
      .digest('hex');

    expect(
      verifyCheckoutSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: stolen,
      }),
    ).toBe(false);
  });

  it('rejects empty, malformed and truncated signatures', () => {
    const base = { razorpayOrderId: orderId, razorpayPaymentId: paymentId };
    expect(verifyCheckoutSignature({ ...base, signature: '' })).toBe(false);
    expect(verifyCheckoutSignature({ ...base, signature: 'not-hex-at-all' })).toBe(false);
    expect(verifyCheckoutSignature({ ...base, signature: sign(KEY_SECRET).slice(0, 32) })).toBe(
      false,
    );
  });
});

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {} } } });

  it('accepts the exact bytes Razorpay signed', () => {
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('rejects the same object re-serialised differently', () => {
    // This is why the route verifies the raw body: reformatting the JSON keeps
    // the meaning but changes the digest.
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyWebhookSignature(reserialised, sig)).toBe(false);
  });

  it('rejects a body altered after signing', () => {
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    expect(verifyWebhookSignature(body.replace('captured', 'failed'), sig)).toBe(false);
  });

  it('rejects a signature made with the API secret rather than the webhook secret', () => {
    // The two secrets are different values in the dashboard and are easy to
    // swap in configuration; that mistake must fail closed.
    const wrong = createHmac('sha256', KEY_SECRET).update(body).digest('hex');
    expect(verifyWebhookSignature(body, wrong)).toBe(false);
  });

  it('rejects an unsigned body', () => {
    expect(verifyWebhookSignature(body, '')).toBe(false);
  });
});
