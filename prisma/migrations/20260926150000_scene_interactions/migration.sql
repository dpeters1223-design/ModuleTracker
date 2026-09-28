-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "interactions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "interactivityLevel" INTEGER,
ADD COLUMN     "questions" JSONB NOT NULL DEFAULT '[]';

-- Scene type options renamed: '360 image' is now '360 photo' (Uptale's term).
UPDATE "scenes" SET "backgroundMediaType" = '360 photo' WHERE "backgroundMediaType" = '360 image';
