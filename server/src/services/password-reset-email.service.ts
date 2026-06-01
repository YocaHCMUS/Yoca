import env from "@sv/util/load-env.js";
import nodemailer from "nodemailer";

const RESET_CODE_EXPIRY_MINUTES = 10;

type PasswordResetEmailInput = {
  to: string;
  code: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPasswordResetHtml(appName: string, code: string): string {
  const safeAppName = escapeHtml(appName);
  const safeCode = escapeHtml(code);

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7fb;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="padding:20px 24px;background:#131b26;color:#ffffff;font-size:18px;font-weight:700;">
        ${safeAppName}
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Use this code to reset your ${safeAppName} password:</p>
        <div style="margin:20px 0;padding:16px 20px;background:#f3f4f6;border-radius:8px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">
          ${safeCode}
        </div>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#374151;">This code expires in ${RESET_CODE_EXPIRY_MINUTES} minutes.</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#6b7280;">If you did not request this password reset, ignore this email.</p>
      </div>
    </div>
  </body>
</html>`;
}

function renderPasswordResetText(appName: string, code: string): string {
  return [
    appName,
    "",
    `Your password reset code is: ${code}`,
    "",
    `This code expires in ${RESET_CODE_EXPIRY_MINUTES} minutes.`,
    "If you did not request this password reset, ignore this email.",
  ].join("\n");
}

export async function sendPasswordResetCodeEmail({
  to,
  code,
}: PasswordResetEmailInput): Promise<boolean> {
  const smtp = getTransporter();
  if (!smtp) {
    console.warn("[password-reset] SMTP is not configured; reset email skipped");
    return false;
  }

  const appName = env.APP_NAME || "Yoca";

  try {
    await smtp.sendMail({
      from: `${appName} <${env.SMTP_USER}>`,
      to,
      subject: `${appName} password reset code`,
      text: renderPasswordResetText(appName, code),
      html: renderPasswordResetHtml(appName, code),
    });

    return true;
  } catch {
    console.error("[password-reset] failed to send reset email");
    return false;
  }
}
