import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM =
  process.env.RESEND_FROM ||
  process.env.FROM_EMAIL ||
  "Yoca Alerts <yourcontact@yoca.id.vn>";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

export interface AlertEmailInput {
  rule: string;
  severity: "low" | "medium" | "high";
  message: string;
  signature: string;
  txType: string;
  feePayer: string | null;
  source: string | null;
  swapSolAmount: number;
  emittedAt: string;
}

function severityColor(severity: AlertEmailInput["severity"]): string {
  if (severity === "high") return "#ed4245";
  if (severity === "medium") return "#eab308";
  return "#22c55e";
}

function renderAlertEmailHtml(alert: AlertEmailInput): string {
  const txUrl = `https://solscan.io/tx/${alert.signature}`;
  const color = severityColor(alert.severity);
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#0a0a0f;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#16161e;border:1px solid #2a2a38;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;background:${color};color:#0a0a0f;font-weight:600;letter-spacing:.02em;">
        ${escapeHtml(alert.rule)} &middot; ${alert.severity.toUpperCase()}
      </div>
      <div style="padding:20px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(alert.message)}</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:13px;color:#c6c6c6;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#8a8a8a;width:120px;">Type</td>
            <td style="padding:6px 0;">${escapeHtml(alert.txType || "UNKNOWN")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8a8a8a;">Swap (SOL)</td>
            <td style="padding:6px 0;">${alert.swapSolAmount}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8a8a8a;">Fee payer</td>
            <td style="padding:6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;">${escapeHtml(alert.feePayer || "unknown")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8a8a8a;">Source</td>
            <td style="padding:6px 0;">${escapeHtml(alert.source || "unknown")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8a8a8a;">Signature</td>
            <td style="padding:6px 0;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;">
              <a href="${txUrl}" style="color:#7aa2ff;text-decoration:none;">${escapeHtml(alert.signature)}</a>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#8a8a8a;">
          Emitted at ${escapeHtml(alert.emittedAt)}. You received this because you follow a wallet involved in this transaction.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendAlertEmail(
  to: string,
  alert: AlertEmailInput,
): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.warn("[email] RESEND_API_KEY is not set; skipping alert email", {
      hasRecipient: Boolean(to),
    });
    return false;
  }
  try {
    const result = await client.emails.send({
      from: RESEND_FROM,
      to,
      subject: `[Yoca Alert] ${alert.rule} (${alert.severity})`,
      html: renderAlertEmailHtml(alert),
    });
    if (result.error) {
      console.error("[email] failed to send to", to, result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] failed to send to", to, error);
    return false;
  }
}
