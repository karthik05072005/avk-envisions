'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiClientError, api } from '@/lib/api-client';

/**
 * Opens Razorpay Checkout for one test series.
 *
 * The flow is: ask our server to create an order (which decides the price),
 * hand the returned order id to Razorpay's widget, then send the signed result
 * back for verification. The browser never chooses the amount and never sees
 * the API secret; all it carries is an order id and a signature it cannot
 * forge.
 */

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface CheckoutDraft {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  amountInPaise: number;
  currency: string;
  keyId: string;
  seriesName: string;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** Loads Razorpay's widget once, reusing it on later clicks. */
function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function BuyButton({
  seriesSlug,
  label = 'Get access',
  className,
  size = 'lg',
  variant = 'brand',
  prefill,
}: {
  seriesSlug: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  variant?: 'default' | 'brand' | 'outline' | 'secondary';
  prefill?: { name?: string; email?: string; contact?: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const ready = await loadCheckoutScript();
      if (!ready || !window.Razorpay) {
        toast.error('Could not reach the payment provider. Check your connection and try again.');
        return;
      }

      const draft = await api.post<CheckoutDraft>('/api/checkout', { seriesSlug });

      const widget = new window.Razorpay({
        key: draft.keyId,
        amount: draft.amountInPaise,
        currency: draft.currency,
        name: 'AVK Envisions',
        description: draft.seriesName,
        order_id: draft.razorpayOrderId,
        prefill,
        notes: { orderNumber: draft.orderNumber },
        theme: { color: '#4338ca' },

        handler: async (response: RazorpayResponse) => {
          try {
            await api.post('/api/checkout/verify', response);
            toast.success('Payment confirmed. Your access is active.');
            // Land on the page that carries the community invite and the
            // record of what was bought, rather than refreshing in place.
            router.push('/subscriptions');
            router.refresh();
          } catch (error) {
            // The money may well have been taken — the webhook will still
            // grant access — so this must not read like a failed purchase.
            toast.error(
              error instanceof ApiClientError
                ? error.message
                : `We could not confirm the payment here. If it was debited, your access will appear shortly. Order ${draft.orderNumber}.`,
              { duration: 12_000 },
            );
            router.refresh();
          }
        },

        modal: {
          ondismiss: () => {
            toast.message('Payment cancelled. Nothing has been charged.');
          },
        },
      });

      widget.open();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : 'Could not start checkout. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      loading={busy}
      loadingText="Opening…"
      size={size}
      variant={variant}
      className={className}
    >
      {label}
    </Button>
  );
}
