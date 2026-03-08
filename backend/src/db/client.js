import { Pool } from "pg";
import { config } from "../config/index.js";

// Shared PostgreSQL pool used by all stores/services in the backend.
// SSL behavior is environment-driven to support both local and managed DB targets.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
});

/**
 * Executes a SQL query using the shared pool.
 *
 * Dependencies:
 * - Called by store/service modules as the primary DB access function.
 */
export async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Runs a function inside a database transaction.
 *
 * System flow:
 * - Acquire dedicated client from pool.
 * - Begin transaction.
 * - Execute caller function with client.
 * - Commit on success or rollback on error.
 *
 * Edge case:
 * - Client is always released in `finally`, even when BEGIN/COMMIT/ROLLBACK fails.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
