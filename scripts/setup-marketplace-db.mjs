import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not available. Run this inside the DigitalOcean app console.");
}

const migrationUrl = new URL(
  "../database/migrations/001_bookme_marketplace.sql",
  import.meta.url,
);
const migration = await readFile(migrationUrl, "utf8");
const pool = new Pool({ connectionString, max: 1 });

try {
  await pool.query(migration);
  console.log("BookMe marketplace tables are ready.");
} finally {
  await pool.end();
}
