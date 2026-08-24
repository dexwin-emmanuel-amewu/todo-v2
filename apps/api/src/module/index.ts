import { buildApp } from "./../module/app.js";
import { env } from "./../module/config.js";
import { db } from "../db/client.js";

const app = buildApp(db);

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
