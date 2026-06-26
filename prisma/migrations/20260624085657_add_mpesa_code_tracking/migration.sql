/*
  Warnings:

  - A unique constraint covering the columns `[checkoutRequestId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "checkoutRequestId" TEXT,
ADD COLUMN     "itemizedDetails" JSONB,
ADD COLUMN     "operatorId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_checkoutRequestId_key" ON "Transaction"("checkoutRequestId");
