ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "users" ADD COLUMN "interests" TEXT;

CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

CREATE TABLE "trades" (
  "id" SERIAL NOT NULL,
  "requester_id" INTEGER NOT NULL,
  "receiver_id" INTEGER NOT NULL,
  "offered_cards" JSONB NOT NULL,
  "requested_cards" JSONB NOT NULL,
  "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trades_requester_id_idx" ON "trades"("requester_id");
CREATE INDEX "trades_receiver_id_idx" ON "trades"("receiver_id");
CREATE INDEX "trades_status_idx" ON "trades"("status");
CREATE INDEX "trades_created_at_idx" ON "trades"("created_at");

ALTER TABLE "trades" ADD CONSTRAINT "trades_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trades" ADD CONSTRAINT "trades_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
