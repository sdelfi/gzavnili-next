-- CreateTable
CREATE TABLE "money_collect_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "c_date" TIMESTAMPTZ(6) NOT NULL,
    "a_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "a_credit_card" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "a_bank_deposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "a_wire_transfer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "collected" DECIMAL(12,2) NOT NULL,
    "collector_username" TEXT NOT NULL,
    "g_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_collect_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "money_collect_history_user_id_c_date_idx" ON "money_collect_history"("user_id", "c_date");

-- AddForeignKey
ALTER TABLE "money_collect_history" ADD CONSTRAINT "money_collect_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

