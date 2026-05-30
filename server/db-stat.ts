import postgres from 'postgres';
import { config } from 'dotenv';
config();

async function test() {
  const sql = postgres(process.env.POSTGRES_DB_URL!, { max: 1 });
  try {
    const result = await sql`
      SELECT pid, state, wait_event_type, wait_event, query
      FROM pg_stat_activity
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `;
    console.log("Active queries:", result);
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
test();
