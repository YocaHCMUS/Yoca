import "dotenv/config";
import postgres from "postgres";

async function main() {
  const client = postgres(process.env.POSTGRES_DB_URL!);
  try {
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar;`;
    console.log("Column added successfully.");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await client.end();
  }
}

main();
