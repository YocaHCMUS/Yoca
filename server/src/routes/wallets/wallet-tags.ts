import userExtract from "@sv/middlewares/user-extract.js";
import { honoJwt, validate } from "@sv/middlewares/validation.js";
import { getWalletTags, setWalletTags } from "@sv/services/walletTags.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import { z } from "zod";

// Request Schemas
const saveTagsSchema = z.object({
  address: z.string().min(1, "Address is required"),
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(50, "Maximum 50 tags allowed"),
});

const app = new Hono()
  // GET /api/walletTags?address=<walletAddress>
  .get("/", honoJwt, userExtract, async (c) => {
    try {
      const user = c.get("userPayload");
      const address = c.req.query("address");
      if (!address) {
        return c.json({ error: "address query parameter is required" }, 400);
      }
      const tags = await getWalletTags(user.id, address);
      return c.json({ tags });
    } catch (err) {
      console.error("[walletTags] GET failed:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  // PUT /api/walletTags  body: { address, tags }
  .put(
    "/",
    honoJwt,
    userExtract,
    validate("json", saveTagsSchema),
    async (c) => {
      try {
        const user = c.get("userPayload");
        const { address, tags } = c.req.valid("json");
        await setWalletTags(user.id, address, tags);
        return c.json({ message: "Tags saved successfully" }, statusCode.Ok);
      } catch (err) {
        console.error("[walletTags] PUT failed:", err);
        return c.json({ error: "Internal server error" }, 500);
      }
    },
  );

export default app;

export type WalletTagsAppType = typeof app;
