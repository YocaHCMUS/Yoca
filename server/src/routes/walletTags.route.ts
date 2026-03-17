import { AUTH_COOKIE_NAME } from "@sv/config/constants.js";
import { validate } from "@sv/middlewares/validation.js";
import { getWalletTags, setWalletTags } from "@sv/services/walletTags.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import { z } from "zod";

const honoJwt = jwt({
  alg: "HS256",
  secret: process.env.JWT_SECRET!,
  cookie: AUTH_COOKIE_NAME,
});

// Request Schemas
const saveTagsSchema = z.object({
  address: z.string().min(1, "Address is required"),
  tags: z.array(z.string().trim().min(1).max(30)).max(50, "Maximum 50 tags allowed"),
});

const getTagsQuerySchema = z.object({
  address: z.string().min(1, "Address query parameter is required"),
});

// Response Schemas
const getTagsResponseSchema = z.object({
  tags: z.array(z.string()),
});

const saveTagsResponseSchema = z.object({
  message: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const app = new Hono()
  // GET /api/walletTags?address=<walletAddress>
  .get("/", honoJwt, async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id: string };
      const address = c.req.query("address");
      if (!address) {
        return c.json({ error: "address query parameter is required" }, 400);
      }
      const tags = await getWalletTags(payload.id, address);
      return c.json({ tags });
    } catch (err) {
      console.error("[walletTags] GET failed:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  // PUT /api/walletTags  body: { address, tags }
  .put("/", honoJwt, validate("json", saveTagsSchema), async (c) => {
    try {
      const payload = c.get("jwtPayload") as { id: string };
      const { address, tags } = c.req.valid("json");
      await setWalletTags(payload.id, address, tags);
      return c.json({ message: "Tags saved successfully" }, statusCode.Ok);
    } catch (err) {
      console.error("[walletTags] PUT failed:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

export default app;
