CREATE TABLE "wishlist_items" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "card_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "number" TEXT,
    "rarity" TEXT,
    "variant_type" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'Nao informado',
    "market_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_source" TEXT NOT NULL DEFAULT 'Estimativa local',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wishlist_items_user_id_card_id_key" ON "wishlist_items"("user_id", "card_id");
CREATE INDEX "wishlist_items_user_id_idx" ON "wishlist_items"("user_id");
CREATE INDEX "wishlist_items_card_id_idx" ON "wishlist_items"("card_id");
CREATE INDEX "wishlist_items_set_idx" ON "wishlist_items"("set");

ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
