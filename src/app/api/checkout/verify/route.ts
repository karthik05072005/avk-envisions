import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { AppError } from '@/lib/api';
import { fulfilOrder, verifyCheckoutSignature } from '@/server/services/payment-service';
import { verifyCheckoutSchema } from '@/validations/checkout';

/**
 * POST /api/checkout/verify — confirms a payment the browser just completed.
 *
 * This is the fast path so a student gets access immediately rather than
 * waiting on the webhook. It is not the authoritative one: the webhook covers
 * the case where the browser is closed before this fires, and both converge on
 * the same idempotent fulfilment.
 */
export const POST = route<{ granted: boolean }>(
  async ({ request }) => {
    await requireUser();
    const input = await parseBody(request, verifyCheckoutSchema);

    const valid = verifyCheckoutSignature({
      razorpayOrderId: input.razorpay_order_id,
      razorpayPaymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });

    if (!valid) {
      throw new AppError(
        'FORBIDDEN',
        'This payment could not be verified. If money has left your account, contact support with your order number.',
      );
    }

    const granted = await fulfilOrder({
      razorpayOrderId: input.razorpay_order_id,
      razorpayPaymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });

    return {
      data: { granted },
      message: 'Payment confirmed. Your access is active.',
    };
  },
  { rateLimit: 'checkout' },
);
