import { parseBody, route } from '@/server/api-handler';
import { requireUser } from '@/server/auth/guards';
import { createSeriesCheckout, type CheckoutDraft } from '@/server/services/payment-service';
import { createCheckoutSchema } from '@/validations/checkout';

/**
 * POST /api/checkout — opens a Razorpay order for a test series.
 *
 * The body names only the series. The amount is resolved from the live pricing
 * ladder on the server and frozen onto the order, so a client cannot nominate
 * what it would like to pay.
 */
export const POST = route<CheckoutDraft>(
  async ({ request }) => {
    const user = await requireUser();
    const input = await parseBody(request, createCheckoutSchema);

    const draft = await createSeriesCheckout({
      userId: user.id,
      seriesSlug: input.seriesSlug,
    });

    return { data: draft, message: 'Order created.', status: 201 };
  },
  { rateLimit: 'checkout' },
);
