import "server-only";

import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bookme:bookme@127.0.0.1:5432/bookme";
const databaseCaCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured in production.");
}
if (process.env.NODE_ENV === "production" && !databaseCaCert) {
  throw new Error("DATABASE_CA_CERT must be configured so the production database connection is encrypted and verified.");
}

function connectionStringWithoutSslMode(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return url.toString();
}

const globalForDatabase = globalThis as unknown as {
  bookmeDatabasePool?: Pool;
};

export const database =
  globalForDatabase.bookmeDatabasePool ??
  new Pool({
    connectionString: connectionStringWithoutSslMode(databaseUrl),
    max: 10,
    ssl: databaseCaCert
      ? { ca: databaseCaCert, rejectUnauthorized: true }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.bookmeDatabasePool = database;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
