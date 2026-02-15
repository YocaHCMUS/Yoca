import "dotenv/config";
import { db } from "@sv/db/index.js";
import { tokenMeta } from "@sv/db/schema.js";
import { eq } from "drizzle-orm";

async function checkTokenMeta() {
    const address = "59nzDoRy1jQcLcFyFs4GVdeZ4qUEb16T2KnuHPWMpump";
    const result = await db.select().from(tokenMeta).where(eq(tokenMeta.address, address));
    console.log("Token Meta:", result);
    process.exit(0);
}

checkTokenMeta();
