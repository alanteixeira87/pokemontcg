CREATE TABLE "collection" (
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
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "collection_card_id_key" ON "collection"("card_id");
CREATE INDEX "collection_name_idx" ON "collection"("name");
CREATE INDEX "collection_set_idx" ON "collection"("set");
CREATE INDEX "collection_favorite_idx" ON "collection"("favorite");
CREATE INDEX "collection_for_trade_idx" ON "collection"("for_trade");
