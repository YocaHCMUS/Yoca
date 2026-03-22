import { Hono } from "hono";
import puppeteer, { type Browser } from "puppeteer";

type ExportPdfRequest =
  | {
      title?: string;
      width?: number;
      height?: number;
      html: string;
      svg?: never;
    }
  | {
      title?: string;
      width?: number;
      height?: number;
      svg: string;
      html?: never;
    };

let browserPromise: Promise<Browser> | null = null;

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

const app = new Hono().post("/pdf", async (c) => {
  try {
    const payload = (await c.req.json()) as ExportPdfRequest;
    const title = String(payload?.title ?? "chart");
    const width = clamp(payload?.width, 1280, 600, 3000);
    const height = clamp(payload?.height, 720, 400, 14000);

    const hasHtml = typeof (payload as { html?: unknown }).html === "string";
    const hasSvg = typeof (payload as { svg?: unknown }).svg === "string";

    if (!hasHtml && !hasSvg) {
      return c.json(
        {
          error: "Validation error",
          message: "Request body must include either html or svg as string.",
        },
        400,
      );
    }

    let htmlContent: string;
    if (hasHtml) {
      htmlContent = (payload as { html: string }).html;
    } else {
      const svg = (payload as { svg: string }).svg;
      htmlContent = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .container {
        width: ${width}px;
        min-height: ${height}px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      svg {
        width: 100%;
        height: auto;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="container">${svg}</div>
  </body>
</html>`;
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width, height });
      await page.setContent(htmlContent, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      const pdfArrayBuffer = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength,
      );

      return new Response(pdfArrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${title}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } finally {
      await page.close();
    }
  } catch (error) {
    console.error("[charts/export/pdf] Failed to generate PDF", error);
    return c.json(
      {
        error: "Failed to export PDF",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export default app;
