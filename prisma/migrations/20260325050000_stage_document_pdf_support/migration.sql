ALTER TABLE "StageDocument" ADD COLUMN "pdfData" TEXT;
ALTER TABLE "StageDocument" ADD COLUMN "placeholders" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "StageDocument" ALTER COLUMN "content" SET DEFAULT '';
