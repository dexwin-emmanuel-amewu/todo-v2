import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { Db } from "./todo.repository.js";

describe("app", () => {
  it("responds to a health check", async () => {
    // /health never touches the database, so an unused stub satisfies buildApp's signature.
    const app = buildApp({} as Db);
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
