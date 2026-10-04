import { createApp } from "./app.js";
import { prisma } from "./db.js";
import { env } from "./env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Tiny.run API listening on http://localhost:${env.PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
