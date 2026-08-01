-- AlterTable
ALTER TABLE "config" ADD COLUMN     "gateway" TEXT,
ADD COLUMN     "gateway_login" TEXT,
ADD COLUMN     "gateway_trans_key" TEXT,
ADD COLUMN     "paypal_email" TEXT,
ADD COLUMN     "paypal_password" TEXT,
ADD COLUMN     "paypal_transaction_key" TEXT,
ADD COLUMN     "paypal_user_id" TEXT;
