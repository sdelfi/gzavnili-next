-- CreateTable
CREATE TABLE "messages" (
    "message_id" SERIAL NOT NULL,
    "user_id" UUID,
    "sender_id" UUID,
    "parcel_id" UUID,
    "message_type_key" TEXT,
    "chain" INTEGER,
    "reply_to_id" INTEGER,
    "subject" TEXT,
    "body" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "b_read" BOOLEAN NOT NULL DEFAULT false,
    "b_sms" BOOLEAN NOT NULL DEFAULT false,
    "sms_to" TEXT,
    "sms_body" TEXT,
    "dt_create" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_open" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "messages_b_sms_dt_create_idx" ON "messages"("b_sms", "dt_create");

-- CreateIndex
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");

-- CreateIndex
CREATE INDEX "messages_chain_idx" ON "messages"("chain");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_message_type_key_fkey" FOREIGN KEY ("message_type_key") REFERENCES "message_types"("key") ON DELETE SET NULL ON UPDATE CASCADE;
