DO $$ BEGIN
  CREATE TYPE "VariantType" AS ENUM ('NORMAL', 'FOIL', 'REVERSE_FOIL', 'RARE_ILLUSTRATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TradeCardSide" AS ENUM ('OFFERED', 'REQUESTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE IF NOT EXISTS "card_variants" (
  "id" SERIAL NOT NULL,
  "user_card_id" INTEGER NOT NULL,
  "variant_type" "VariantType" NOT NULL,
  "owned_quantity" INTEGER NOT NULL DEFAULT 0,
  "trade_quantity" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "card_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "card_variants_user_card_id_variant_type_key" ON "card_variants"("user_card_id", "variant_type");
CREATE INDEX IF NOT EXISTS "card_variants_user_card_id_idx" ON "card_variants"("user_card_id");
CREATE INDEX IF NOT EXISTS "card_variants_variant_type_idx" ON "card_variants"("variant_type");

ALTER TABLE "card_variants" DROP CONSTRAINT IF EXISTS "card_variants_user_card_id_fkey";
ALTER TABLE "card_variants" ADD CONSTRAINT "card_variants_user_card_id_fkey" FOREIGN KEY ("user_card_id") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "trade_cards" (
  "id" SERIAL NOT NULL,
  "trade_id" INTEGER NOT NULL,
  "collection_id" INTEGER NOT NULL,
  "card_id" TEXT NOT NULL,
  "variant_type" "VariantType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "side" "TradeCardSide" NOT NULL,
  "name" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "set" TEXT NOT NULL,
  "number" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "trade_cards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_cards_trade_id_idx" ON "trade_cards"("trade_id");
CREATE INDEX IF NOT EXISTS "trade_cards_collection_id_idx" ON "trade_cards"("collection_id");
CREATE INDEX IF NOT EXISTS "trade_cards_side_idx" ON "trade_cards"("side");

ALTER TABLE "trade_cards" DROP CONSTRAINT IF EXISTS "trade_cards_trade_id_fkey";
ALTER TABLE "trade_cards" ADD CONSTRAINT "trade_cards_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trade_cards" DROP CONSTRAINT IF EXISTS "trade_cards_collection_id_fkey";
ALTER TABLE "trade_cards" ADD CONSTRAINT "trade_cards_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "trade_messages" (
  "id" SERIAL NOT NULL,
  "trade_id" INTEGER NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "receiver_id" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "trade_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trade_messages_trade_id_idx" ON "trade_messages"("trade_id");
CREATE INDEX IF NOT EXISTS "trade_messages_sender_id_idx" ON "trade_messages"("sender_id");
CREATE INDEX IF NOT EXISTS "trade_messages_receiver_id_idx" ON "trade_messages"("receiver_id");
CREATE INDEX IF NOT EXISTS "trade_messages_is_read_idx" ON "trade_messages"("is_read");

ALTER TABLE "trade_messages" DROP CONSTRAINT IF EXISTS "trade_messages_trade_id_fkey";
ALTER TABLE "trade_messages" ADD CONSTRAINT "trade_messages_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trade_messages" DROP CONSTRAINT IF EXISTS "trade_messages_sender_id_fkey";
ALTER TABLE "trade_messages" ADD CONSTRAINT "trade_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trade_messages" DROP CONSTRAINT IF EXISTS "trade_messages_receiver_id_fkey";
ALTER TABLE "trade_messages" ADD CONSTRAINT "trade_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
