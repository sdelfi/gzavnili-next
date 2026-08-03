-- AlterTable
ALTER TABLE "config" ADD COLUMN     "email_footer" TEXT,
ADD COLUMN     "email_header" TEXT,
ADD COLUMN     "email_recipients" TEXT,
ADD COLUMN     "email_sender" TEXT;

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "sender" TEXT,
    "recipients" TEXT,
    "description" TEXT,
    "tags" TEXT,
    "recipient_overwrite" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);
