import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./plugins/prisma.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`API listening at http://127.0.0.1:${env.PORT}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
