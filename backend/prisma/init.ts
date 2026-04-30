import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "collection" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "card_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "set" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "price" REAL NOT NULL DEFAULT 0,
      "favorite" BOOLEAN NOT NULL DEFAULT false,
      "for_trade" BOOLEAN NOT NULL DEFAULT false,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "collection_card_id_key" ON "collection"("card_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_name_idx" ON "collection"("name")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_set_idx" ON "collection"("set")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_favorite_idx" ON "collection"("favorite")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_for_trade_idx" ON "collection"("for_trade")`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("SQLite database ready.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
