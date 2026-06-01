import Coingecko, { APIPromise } from "@coingecko/coingecko-typescript";
import { validateResponseDataSchema } from "@sv/middlewares/validation";
import { z } from "zod";

export function getEndpoint(path: string): URL {
  return new URL(`${process.env.COINGECKO_API_BASE_URL}${path}`);
}

export function getOnchainEndpoint(path: string): URL {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(
    `${process.env.COINGECKO_API_BASE_URL}/onchain/${normalizedPath}`,
  );
}

export function getRequiredHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-cg-demo-api-key": process.env.COINGECKO_API_KEY!,
  };

  return headers;
}

export const client = new Coingecko({
  demoAPIKey: process.env.COINGECKO_API_KEY,
  environment: "demo",
});

export async function safeClient<T>(request: APIPromise<T>): Promise<T | null>;

export async function safeClient<S extends z.ZodTypeAny>(
  request: APIPromise<unknown>,
  schema: S,
): Promise<z.infer<S> | null>;

export async function safeClient<T, S extends z.ZodTypeAny>(
  request: APIPromise<T>,
  schema?: S,
): Promise<T | z.infer<S> | null> {
  try {
    const { data, response: resp } = await request.withResponse();

    if (!resp.ok) {
      console.error("Coingecko API error: Failed response:\n", data);
      return null;
    }

    if (schema) {
      const validatedData = await validateResponseDataSchema(
        resp.status,
        data,
        schema,
        true,
      );

      return validatedData ?? null;
    }

    return data;
  } catch (err: unknown) {
    console.log("Coingecko API error: Unknown Error:\n", err);
    return null;
  }
}
