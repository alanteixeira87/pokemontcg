import { app } from "./app.js";
import { initDatabase } from "./database/initDatabase.js";
import { prisma } from "./database/prisma.js";
import { env } from "./utils/env.js";

const server = await initDatabase().then(() =>
  app.listen(env.port, () => {
    console.log(JSON.stringify({ level: "info", message: `API running on port ${env.port}` }));
  })
);

server.on("error", async (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      JSON.stringify({
        level: "error",
        message: `Porta ${env.port} ja esta em uso. Feche o outro servidor ou altere PORT no arquivo .env.`
      })
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.error(JSON.stringify({ level: "error", message: "Falha ao iniciar servidor.", error: error.message }));
  await prisma.$disconnect();
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  server.close();
});
