import { z } from 'zod';

export const createCheckoutSchema = z.object({
  /** Slug of the test series being bought. The price is resolved server-side. */
  seriesSlug: z.string().trim().min(1, 'Series is required'),
});

export const verifyCheckoutSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type VerifyCheckoutInput = z.infer<typeof verifyCheckoutSchema>;
