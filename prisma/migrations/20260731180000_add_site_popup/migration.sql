-- AlterTable
ALTER TABLE "config" ADD COLUMN     "popup_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "popup_message_en" TEXT,
ADD COLUMN     "popup_message_ge" TEXT;
