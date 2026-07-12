import postgres from "postgres";

const connectionString = process.env.DATABASE_TRANSACTION_URL;

if (!connectionString) {
  console.error(
    [
      "DATABASE_TRANSACTION_URL is not defined.",
      "",
      "Add the Supabase Transaction pooler connection string to server/.env:",
      "DATABASE_TRANSACTION_URL=postgresql://...",
    ].join("\n"),
  );

  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(connectionString);
} catch {
  console.error("DATABASE_TRANSACTION_URL is not a valid PostgreSQL URL.");
  process.exit(1);
}

const port = parsedUrl.port || "5432";

console.log("Testing Supabase Transaction pooler:", {
  host: parsedUrl.hostname,
  port,
  database: parsedUrl.pathname.replace(/^\//, ""),
  username: decodeURIComponent(parsedUrl.username),
  passwordPresent: Boolean(parsedUrl.password),
  preparedStatementsEnabled: false,
});

if (port !== "6543") {
  console.error(
    [
      "",
      `Expected Transaction pooler port 6543, but received port ${port}.`,
      "Copy the Transaction pooler connection string from the Supabase Connect dialog.",
    ].join("\n"),
  );

  process.exit(1);
}

const attempts = 5;
const delayBetweenAttemptsMs = 2_000;

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function serializeError(error) {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
    };
  }

  return {
    name: error.name,
    code: error.code,
    message: error.message,
    errno: error.errno,
    syscall: error.syscall,
    address: error.address,
    port: error.port,
  };
}

let successCount = 0;
let failureCount = 0;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  /*
   * A separate client is intentionally created for each attempt.
   * This verifies that Supavisor can establish multiple fresh connections.
   */
  const sql = postgres(connectionString, {
    max: 1,

    /*
     * Supabase Transaction pooler does not support prepared statements.
     * This must remain false when using port 6543.
     */
    prepare: false,

    connect_timeout: 30,
    idle_timeout: 5,
    max_lifetime: 60,

    connection: {
      application_name: `yoca-transaction-test-${attempt}`,
    },

    onnotice: () => {
      // Suppress nonessential PostgreSQL notices during this diagnostic.
    },
  });

  const startedAt = Date.now();

  try {
    console.log(`\nAttempt ${attempt}/${attempts}: connecting...`);

    const [result] = await sql`
      select
        now() as database_time,
        current_database() as database_name,
        current_user as database_user,
        pg_backend_pid() as backend_pid,
        version() as postgres_version
    `;

    const elapsedMs = Date.now() - startedAt;
    successCount += 1;

    console.log(`Attempt ${attempt} succeeded in ${elapsedMs} ms.`);
    console.log({
      databaseTime: result.database_time,
      databaseName: result.database_name,
      databaseUser: result.database_user,
      backendPid: result.backend_pid,
      postgresVersion: result.postgres_version,
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    failureCount += 1;

    console.error(`Attempt ${attempt} failed after ${elapsedMs} ms.`);
    console.error(serializeError(error));
  } finally {
    try {
      await sql.end({
        timeout: 5,
      });
    } catch (error) {
      console.error(
        `Attempt ${attempt}: failed to close the test client cleanly.`,
        serializeError(error),
      );
    }
  }

  if (attempt < attempts) {
    await sleep(delayBetweenAttemptsMs);
  }
}

console.log("\nTransaction pooler test summary:", {
  attempts,
  successes: successCount,
  failures: failureCount,
});

if (successCount === attempts) {
  console.log(
    "Result: Transaction pooler connections are working consistently.",
  );
  process.exit(0);
}

if (successCount > 0) {
  console.error(
    "Result: Transaction pooler connectivity is intermittent.",
  );
  process.exit(2);
}

console.error(
  "Result: Every Transaction pooler connection attempt failed.",
);
process.exit(1);