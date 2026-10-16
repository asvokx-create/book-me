import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (process.env.BOOKME_MIGRATION_TEST_DATABASE !== "1") {
  throw new Error("Refusing to run: BOOKME_MIGRATION_TEST_DATABASE=1 is required.");
}

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the disposable migration test database.");
}

const databaseUrl = new URL(connectionString);
if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)) {
  throw new Error("Refusing to run against a non-local database host.");
}

const migration = await readFile(
  new URL("../database/migrations/093_booking_fee_caps_and_processing_costs.sql", import.meta.url),
  "utf8",
);
const schema = `fee_cap_migration_test_${process.pid}_${Date.now()}`;
const quotedSchema = `"${schema}"`;
const client = new Client({ connectionString });
let connected = false;

try {
  await client.connect();
  connected = true;
  await client.query(`CREATE SCHEMA ${quotedSchema}`);
  await client.query(`SET search_path TO ${quotedSchema}`);
  await client.query(`
    CREATE TABLE bookings (
      id text PRIMARY KEY,
      price_cents integer NOT NULL,
      platform_fee_cents integer NOT NULL,
      customer_total_cents integer NOT NULL,
      payment_status text NOT NULL
    )
  `);
  await client.query(
    `INSERT INTO bookings (id, price_cents, platform_fee_cents, customer_total_cents, payment_status)
     VALUES ('historical-booking', 6500000, 20000, 6500299, 'paid')`,
  );

  await client.query(migration);

  const historical = await client.query(
    `SELECT price_cents, platform_fee_cents, customer_total_cents, payment_status,
            provider_fee_cap_cents, stripe_processing_fee_cents,
            provider_processing_fee_cents, processing_fee_status
     FROM bookings WHERE id = 'historical-booking'`,
  );
  assert.deepEqual(historical.rows[0], {
    price_cents: 6500000,
    platform_fee_cents: 20000,
    customer_total_cents: 6500299,
    payment_status: "paid",
    provider_fee_cap_cents: null,
    stripe_processing_fee_cents: null,
    provider_processing_fee_cents: 0,
    processing_fee_status: "not_applicable",
  }, "migration must preserve historical financial facts and supply only safe defaults");

  await client.query(
    `INSERT INTO bookings (id, price_cents, platform_fee_cents, customer_total_cents, payment_status,
      provider_fee_cap_cents, stripe_processing_fee_cents, provider_processing_fee_cents, processing_fee_status)
     VALUES ('new-booking', 500000, 20000, 500299, 'pending', 20000, 14750, 14741, 'final')`,
  );
  const newBooking = await client.query(
    `SELECT provider_fee_cap_cents, stripe_processing_fee_cents,
            provider_processing_fee_cents, processing_fee_status
     FROM bookings WHERE id = 'new-booking'`,
  );
  assert.deepEqual(newBooking.rows[0], {
    provider_fee_cap_cents: 20000,
    stripe_processing_fee_cents: 14750,
    provider_processing_fee_cents: 14741,
    processing_fee_status: "final",
  }, "new booking financial fields must store valid fee snapshots");

  await assert.rejects(
    client.query(`UPDATE bookings SET provider_fee_cap_cents = -1 WHERE id = 'new-booking'`),
    /bookings_provider_fee_cap_cents_check/,
  );
  await assert.rejects(
    client.query(`UPDATE bookings SET processing_fee_status = 'unexpected' WHERE id = 'new-booking'`),
    /bookings_processing_fee_status_check/,
  );

  await client.query(migration);
  console.log("Migration 093 passed on a disposable PostgreSQL schema.");
} finally {
  if (connected) {
    await client.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => undefined);
    await client.end();
  }
}
