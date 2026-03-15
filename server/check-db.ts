import postgres from "postgres";

process.loadEnvFile("./.env");

const url = process.env.POSTGRES_DB_URL;
const sql = postgres(url!);

async function check() {
  try {
    const schemas = await sql`
      SELECT nspname AS schema_name
      FROM pg_catalog.pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema';
    `;

    const tables = await sql`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT LIKE 'pg_%' AND table_schema <> 'information_schema';
    `;

    const marketCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'token_market_data';
    `;

    const metaCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'token_meta';
    `;

    const result = {
      url_masked: url?.replace(/(?<=:\/\/)(.*)(?=@)/, "******"),
      schemas,
      tables,
      marketCols,
      metaCols
    };

    console.log("DIAG_RESULT_START");
    console.log(JSON.stringify(result, null, 2));
    console.log("DIAG_RESULT_END");

  } catch (err) {
    console.error("DIAG_ERROR:", err);
  } finally {
    await sql.end();
  }
}

check();
