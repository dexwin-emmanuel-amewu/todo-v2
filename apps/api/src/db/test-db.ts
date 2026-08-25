import { randomUUID } from "node:crypto";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

import { env } from "../module/config.js";
import * as schema from "./schema.js";

export type DisposableDb = NodePgDatabase<typeof schema>;

export interface DisposableDatabase {
  name: string;
  db: DisposableDb;
  pool: Pool;
}

function urlFor(databaseName: string): string {
  const url = new URL(env.DATABASE_URL);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

export async function createDisposableDatabase(): Promise<DisposableDatabase> {
  const name = `test_${randomUUID().replaceAll("-", "")}`;

  const admin = new Client({ connectionString: urlFor("postgres") });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const pool = new Pool({ connectionString: urlFor(name) });
  const db = drizzle(pool, { schema });

  return { name, db, pool };
}

export async function migrateDisposableDatabase(database: DisposableDatabase): Promise<void> {
  await migrate(database.db, { migrationsFolder: "./drizzle" });
}

export async function dropDisposableDatabase(database: DisposableDatabase): Promise<void> {
  await database.pool.end();

  const admin = new Client({ connectionString: urlFor("postgres") });
  await admin.connect();
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [database.name],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${database.name}"`);
  await admin.end();
}
