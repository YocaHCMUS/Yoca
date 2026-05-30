const postgres = require('postgres');
require('dotenv').config();

console.log("DB URL:", process.env.POSTGRES_DB_URL);

async function test() {
  const sql = postgres(process.env.POSTGRES_DB_URL, { max: 1, idle_timeout: 3 });
  try {
    console.log("Connecting...");
    const result = await sql`SELECT 1 as test`;
    console.log("Success!", result);
  } catch (e) {
    console.error("Error connecting:", e);
  } finally {
    await sql.end();
  }
}
test();
