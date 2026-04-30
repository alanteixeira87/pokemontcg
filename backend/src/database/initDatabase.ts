import { prisma } from "./prisma.js";

export async function initDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "password_hash" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`);
  await prisma.$executeRawUnsafe(`
    INSERT OR IGNORE INTO "users" ("id", "name", "email", "password_hash", "created_at", "updated_at")
    VALUES (1, 'Usuario local', 'local@pokemon.local', '$2a$10$5Y3DqM2fkIhFYzHzMgNdWenbmnfk6vM3Qf7uW1Le6AzL3o9mq1yN2', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "collection" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "user_id" INTEGER NOT NULL DEFAULT 1,
      "card_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "set" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "price" REAL NOT NULL DEFAULT 0,
      "favorite" BOOLEAN NOT NULL DEFAULT false,
      "for_trade" BOOLEAN NOT NULL DEFAULT false,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "collection_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("collection")`);
  if (!columns.some((column) => column.name === "user_id")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "collection" ADD COLUMN "user_id" INTEGER NOT NULL DEFAULT 1`);
  }

  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "collection_card_id_key"`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "collection_user_id_card_id_key" ON "collection"("user_id", "card_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_name_idx" ON "collection"("name")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_user_id_idx" ON "collection"("user_id")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_set_idx" ON "collection"("set")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_favorite_idx" ON "collection"("favorite")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "collection_for_trade_idx" ON "collection"("for_trade")`);
}
