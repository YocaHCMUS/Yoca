import "dotenv/config";
import postgres from "postgres";

async function main() {
  const client = postgres(process.env.POSTGRES_DB_URL!);
  try {
    const users = await client`SELECT id, display_name, email, avatar_url FROM users`;
    console.log(users);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
