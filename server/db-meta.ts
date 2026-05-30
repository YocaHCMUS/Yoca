import postgres from 'postgres';
import { config } from 'dotenv';
config();

async function test() {
  const sql = postgres(process.env.POSTGRES_DB_URL, { max: 1 });
  try {
    const result = await sql`SELECT * FROM coin_gecko_token_list_meta`;
    console.log("Meta:", result);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
test();
