import { betterAuth } from "better-auth";
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

export const auth = betterAuth({
  database: new Pool({
    connectionString: connectionStringWithoutSslMode(databaseUrl),
    max: 10,
    ssl: databaseCaCert
      ? { ca: databaseCaCert, rejectUnauthorized: true }
      : undefined,
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "bookme-local-development-secret-change-before-deploy",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: true,
      },
      role: {
        type: ["customer", "provider"],
        required: true,
        defaultValue: "customer",
        input: false,
      },
    },
  },
});

export function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}
