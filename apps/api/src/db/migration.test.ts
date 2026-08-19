import { describe, expect, it } from "vitest";

import {
  createDisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
} from "./test-db.js";

describe("todos migration proof", () => {
  it("migrates an empty, disposable database into a working todos table", async () => {
    const database = await createDisposableDatabase();

    try {
      const beforeMigration = await database.pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      );
      expect(beforeMigration.rows).toHaveLength(0);

      await migrateDisposableDatabase(database);

      const columns = await database.pool.query(
        `SELECT column_name, is_nullable
           FROM information_schema.columns
           WHERE table_name = 'todos'
           ORDER BY column_name`,
      );
      expect(columns.rows).toEqual([
        { column_name: "completed", is_nullable: "NO" },
        { column_name: "created_at", is_nullable: "NO" },
        { column_name: "id", is_nullable: "NO" },
        { column_name: "title", is_nullable: "NO" },
      ]);

      const primaryKey = await database.pool.query(
        `SELECT constraint_type FROM information_schema.table_constraints
           WHERE table_name = 'todos' AND constraint_type = 'PRIMARY KEY'`,
      );
      expect(primaryKey.rows).toHaveLength(1);

      await expect(
        database.pool.query("INSERT INTO todos (title, completed) VALUES (NULL, false)"),
      ).rejects.toThrow();

      const inserted = await database.pool.query(
        "INSERT INTO todos (title) VALUES ($1) RETURNING id",
        ["Prove the migration works"],
      );

      const read = await database.pool.query("SELECT title, completed FROM todos WHERE id = $1", [
        inserted.rows[0].id,
      ]);
      expect(read.rows[0]).toEqual({ title: "Prove the migration works", completed: false });
    } finally {
      await dropDisposableDatabase(database);
    }
  }, 20_000);
});
