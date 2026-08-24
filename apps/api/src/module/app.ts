import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import Fastify from "fastify";

import type * as schema from "../db/schema.js";
import { registerTodoRoutes } from "./todo.routes.js";

type Db = NodePgDatabase<typeof schema>;

export function buildApp(db: Db) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));

  registerTodoRoutes(app, db);

  return app;
}
