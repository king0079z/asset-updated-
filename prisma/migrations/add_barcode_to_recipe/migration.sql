-- Add barcode field to Recipe table
ALTER TABLE "Recipe" ADD COLUMN "barcode" TEXT UNIQUE;