-- CreateTable
CREATE TABLE "product_comment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_comment_read" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_comment_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soundtrack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soundtrack_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "product" ADD COLUMN "soundtrackId" TEXT;
ALTER TABLE "product" ADD COLUMN "soundtrackStartMs" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "product_comment_productId_createdAt_idx" ON "product_comment"("productId", "createdAt");
CREATE INDEX "product_comment_userId_idx" ON "product_comment"("userId");
CREATE UNIQUE INDEX "product_comment_read_userId_commentId_key" ON "product_comment_read"("userId", "commentId");
CREATE INDEX "product_comment_read_userId_idx" ON "product_comment_read"("userId");

-- AddForeignKey
ALTER TABLE "product_comment" ADD CONSTRAINT "product_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_comment" ADD CONSTRAINT "product_comment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_comment_read" ADD CONSTRAINT "product_comment_read_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_comment_read" ADD CONSTRAINT "product_comment_read_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "product_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_soundtrackId_fkey" FOREIGN KEY ("soundtrackId") REFERENCES "soundtrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
