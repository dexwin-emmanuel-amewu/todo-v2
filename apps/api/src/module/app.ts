import Fastify from "fastify";

import type { Db } from "./todo.repository.js";
import { registerTodoRoutes } from "./todo.routes.js";

export function buildApp(db: Db) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));
  registerTodoRoutes(app, db);

  return app;
}
