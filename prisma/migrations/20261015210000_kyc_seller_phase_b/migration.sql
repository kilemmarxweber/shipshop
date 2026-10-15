-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateTable
CREATE TABLE "seller_kyc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'NONE',
    "sellerType" "SellerType",
    "legalName" TEXT,
    "phone" TEXT,
    "idNumber" TEXT,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "selfieUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_kyc_userId_key" ON "seller_kyc"("userId");

-- CreateIndex
CREATE INDEX "seller_kyc_status_idx" ON "seller_kyc"("status");

-- AddForeignKey
ALTER TABLE "seller_kyc" ADD CONSTRAINT "seller_kyc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_kyc" ADD CONSTRAINT "seller_kyc_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
