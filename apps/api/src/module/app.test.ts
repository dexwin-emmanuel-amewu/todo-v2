import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDisposableDatabase,
  type DisposableDatabase,
  dropDisposableDatabase,
  migrateDisposableDatabase,
} from "../db/test-db";
import { buildApp } from "./app.js";

describe("app", () => {
  let database: DisposableDatabase;

  beforeAll(async () => {
    database = await createDisposableDatabase();
    await migrateDisposableDatabase(database);
  }, 20_000);

  afterAll(async () => {
    await dropDisposableDatabase(database);
  }, 20_000);

  it("responds to a health check", async () => {
    const app = buildApp(database.db);
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
