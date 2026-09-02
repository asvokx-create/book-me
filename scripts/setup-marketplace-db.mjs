import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const databaseCaCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

if (!connectionString) {
  throw new Error("DATABASE_URL is not available. Run this inside the DigitalOcean app console.");
}

const migrationsUrl = new URL("../database/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsUrl))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();
const databaseUrl = new URL(connectionString);
databaseUrl.searchParams.delete("sslmode");
const pool = new Pool({
  connectionString: databaseUrl.toString(),
  max: 1,
  ssl: databaseCaCert
    ? { ca: databaseCaCert, rejectUnauthorized: true }
    : undefined,
});

try {
  for (const fileName of migrationFiles) {
    const migration = await readFile(new URL(fileName, migrationsUrl), "utf8");
    await pool.query(migration);
    console.log(`Applied ${fileName}.`);
  }
  console.log("BookMe marketplace tables are ready.");
} finally {
  await pool.end();
}
