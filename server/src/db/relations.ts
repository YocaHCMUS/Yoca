import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.js";

export const relations = defineRelations(schema, (r) => ({
  users: {
    posts: r.many.posts({
      from: r.users.id,
      to: r.posts.userId,
    }),
  },
  tokenMarketData: {
    tokenMeta: r.one.tokenMeta({
      from: r.tokenMarketData.address,
      to: r.tokenMeta.address,
    }),
  },
}));
