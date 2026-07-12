import postgres from "postgres";

const connectionString = process.env.POSTGRES_DB_URL;

if (!connectionString) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const parsedUrl = new URL(connectionString);

console.log("Testing Supabase connection:", {
  host: parsedUrl.hostname,
  port: parsedUrl.port || "5432",
  database: parsedUrl.pathname.replace(/^\//, ""),
  username: decodeURIComponent(parsedUrl.username),
  passwordPresent: Boolean(parsedUrl.password),
});

const isTransactionMode = parsedUrl.port === "6543";

for (let attempt = 1; attempt <= 5; attempt += 1) {
  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 5,

    // Supavisor transaction mode does not support prepared statements.
    prepare: !isTransactionMode,

    connection: {
      application_name: `yoca-connection-test-${attempt}`,
    },
  });

  const startedAt = Date.now();

  try {
    const [result] = await sql`
      select
        now() as database_time,
        current_database() as database_name,
        current_user as database_user,
        pg_backend_pid() as backend_pid
    `;

    console.log(`Attempt ${attempt} succeeded in ${Date.now() - startedAt} ms`);
    console.log(result);
  } catch (error) {
    console.error(`Attempt ${attempt} failed after ${Date.now() - startedAt} ms`, {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      address: error?.address,
      port: error?.port,
    });
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }

  await new Promise((resolve) => setTimeout(resolve, 2_000));
}