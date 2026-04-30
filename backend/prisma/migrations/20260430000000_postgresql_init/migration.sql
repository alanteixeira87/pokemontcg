CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collection" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "card_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "image" TEXT NOT NULL,
  "set" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "for_trade" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "collection_user_id_card_id_key" ON "collection"("user_id", "card_id");
CREATE INDEX "collection_name_idx" ON "collection"("name");
CREATE INDEX "collection_user_id_idx" ON "collection"("user_id");
CREATE INDEX "collection_set_idx" ON "collection"("set");
CREATE INDEX "collection_favorite_idx" ON "collection"("favorite");
CREATE INDEX "collection_for_trade_idx" ON "collection"("for_trade");

ALTER TABLE "collection"
ADD CONSTRAINT "collection_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
