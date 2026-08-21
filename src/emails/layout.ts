import { publicEnv } from '@/lib/env';

/**
 * Email HTML layout.
 *
 * Email clients (Outlook especially) support far less CSS than browsers, so
 * this layout deliberately uses table-based structure and inline styles rather
 * than the design tokens used everywhere else in the product. Colours are kept
 * in sync with the brand palette by hand — there is no way to share CSS
 * variables with an email client.
 */

const BRAND = {
  primary: '#4338ca',
  primaryDark: '#3730a3',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  background: '#f1f5f9',
  surface: '#ffffff',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
} as const;

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailLayoutOptions {
  /** Shown in the inbox preview line, before the body is opened. */
  preheader: string;
  heading: string;
  /** Paragraphs of body copy. Plain strings; HTML is escaped by the caller. */
  body: string[];
  button?: EmailButton;
  /** Rendered as a bordered detail panel, e.g. order or result summaries. */
  details?: { label: string; value: string }[];
  /** Small print under the button, e.g. link expiry notices. */
  footnote?: string;
}

/** Escapes untrusted values before they are interpolated into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDetails(details: { label: string; value: string }[]): string {
  const rows = details
    .map(
      ({ label, value }) => `
              <tr>
                <td style="padding:8px 0;color:${BRAND.muted};font-size:14px;">${escapeHtml(label)}</td>
                <td style="padding:8px 0;color:${BRAND.text};font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
              </tr>`,
    )
    .join('');

  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid ${BRAND.border};border-radius:12px;padding:16px 20px;background:#f8fafc;">
            ${rows}
          </table>`;
}

export function renderEmail(options: EmailLayoutOptions): string {
  const { preheader, heading, body, button, details, footnote } = options;
  const appName = publicEnv.appName;
  const year = new Date().getFullYear();

  const paragraphs = body
    .map(
      (text) =>
        `<p style="margin:0 0 16px;color:${BRAND.text};font-size:15px;line-height:1.65;">${text}</p>`,
    )
    .join('');

  const buttonHtml = button
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr>
              <td style="border-radius:10px;background:${BRAND.primary};">
                <a href="${escapeHtml(button.url)}"
                   style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                  ${escapeHtml(button.label)}
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0 0 8px;color:${BRAND.muted};font-size:13px;line-height:1.6;">
            If the button does not work, copy and paste this link into your browser:<br />
            <a href="${escapeHtml(button.url)}" style="color:${BRAND.primary};word-break:break-all;">${escapeHtml(button.url)}</a>
          </p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- Preheader: shown in the inbox list, hidden in the opened message. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">

            <tr>
              <td style="padding:28px 32px 0;">
                <span style="display:inline-block;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${BRAND.primary};">
                  ${escapeHtml(appName)}
                </span>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:${BRAND.text};">
                  ${escapeHtml(heading)}
                </h1>
                ${paragraphs}
                ${details && details.length > 0 ? renderDetails(details) : ''}
                ${buttonHtml}
                ${footnote ? `<p style="margin:16px 0 0;color:${BRAND.muted};font-size:13px;line-height:1.6;">${footnote}</p>` : ''}
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${BRAND.border};background:#fafafa;">
                <p style="margin:0 0 6px;color:${BRAND.muted};font-size:12px;line-height:1.6;">
                  You are receiving this email because you have an account with ${escapeHtml(appName)}.
                </p>
                <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.6;">
                  &copy; ${year} ${escapeHtml(appName)}. All rights reserved.
                  &nbsp;·&nbsp;
                  <a href="${publicEnv.appUrl}/settings/notifications" style="color:${BRAND.muted};">Notification settings</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Plain-text alternative. Every email must ship one: it is what text-only
 * clients display and what spam filters look for in a legitimate message.
 */
export function renderPlainText(options: EmailLayoutOptions): string {
  const lines: string[] = [options.heading, ''];

  for (const paragraph of options.body) {
    lines.push(stripTags(paragraph), '');
  }

  if (options.details?.length) {
    for (const { label, value } of options.details) {
      lines.push(`${label}: ${value}`);
    }
    lines.push('');
  }

  if (options.button) {
    lines.push(`${options.button.label}: ${options.button.url}`, '');
  }

  if (options.footnote) {
    lines.push(stripTags(options.footnote), '');
  }

  lines.push(`— ${publicEnv.appName}`);
  return lines.join('\n');
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export { BRAND as EMAIL_BRAND };
