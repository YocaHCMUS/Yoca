import postgres from 'postgres';
import { config } from 'dotenv';
config();
const sql = postgres(process.env.POSTGRES_DB_URL, { max: 1 });
sql`SELECT * FROM user_token_watch_list`.then(console.log).catch(console.error).finally(() => sql.end());
