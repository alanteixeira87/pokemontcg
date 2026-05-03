CREATE TABLE IF NOT EXISTS "wanted_cards" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "card_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "set" TEXT NOT NULL,
  "set_id" TEXT,
  "number" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wanted_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wanted_cards_user_id_card_id_key" ON "wanted_cards"("user_id", "card_id");
CREATE INDEX IF NOT EXISTS "wanted_cards_user_id_idx" ON "wanted_cards"("user_id");
CREATE INDEX IF NOT EXISTS "wanted_cards_set_idx" ON "wanted_cards"("set");
CREATE INDEX IF NOT EXISTS "wanted_cards_set_id_idx" ON "wanted_cards"("set_id");
CREATE INDEX IF NOT EXISTS "wanted_cards_number_idx" ON "wanted_cards"("number");

ALTER TABLE "wanted_cards" DROP CONSTRAINT IF EXISTS "wanted_cards_user_id_fkey";
ALTER TABLE "wanted_cards" ADD CONSTRAINT "wanted_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
