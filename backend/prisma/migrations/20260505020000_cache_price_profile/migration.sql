CREATE TABLE "cached_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "set_id" TEXT,
    "number" TEXT,
    "rarity" TEXT,
    "market_price" DOUBLE PRECISION,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cached_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" TEXT,
    "ptcgo_code" TEXT,
    "printed_total" INTEGER,
    "total" INTEGER,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cached_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_history" (
    "id" SERIAL NOT NULL,
    "card_id" TEXT,
    "card_name" TEXT NOT NULL,
    "collection_name" TEXT NOT NULL,
    "set_code" TEXT,
    "card_number" TEXT,
    "variant_type" TEXT NOT NULL,
    "card_class" TEXT NOT NULL,
    "min_price" DOUBLE PRECISION NOT NULL,
    "avg_price" DOUBLE PRECISION NOT NULL,
    "max_price" DOUBLE PRECISION NOT NULL,
    "estimated_price" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cached_cards_name_idx" ON "cached_cards"("name");
CREATE INDEX "cached_cards_set_id_idx" ON "cached_cards"("set_id");
CREATE INDEX "cached_cards_set_idx" ON "cached_cards"("set");
CREATE INDEX "cached_cards_number_idx" ON "cached_cards"("number");
CREATE INDEX "cached_sets_name_idx" ON "cached_sets"("name");
CREATE INDEX "cached_sets_ptcgo_code_idx" ON "cached_sets"("ptcgo_code");
CREATE INDEX "price_history_card_id_idx" ON "price_history"("card_id");
CREATE INDEX "price_history_card_name_idx" ON "price_history"("card_name");
CREATE INDEX "price_history_collection_name_idx" ON "price_history"("collection_name");
CREATE INDEX "price_history_created_at_idx" ON "price_history"("created_at");
