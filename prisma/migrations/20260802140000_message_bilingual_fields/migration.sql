
-- AlterTable
ALTER TABLE "message_types" ADD COLUMN     "label_ge" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "body_ge" TEXT,
ADD COLUMN     "subject_ge" TEXT;

