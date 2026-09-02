import "server-only";

import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://bookme:bookme@127.0.0.1:5432/bookme";
const databaseCaCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

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
