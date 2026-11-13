-- Workstream C: product_batches.manufacture_date and created_by.
--
-- The product creation validation schema already requires manufacture_date and
-- the createProductAction payload already supplies created_by, but the columns
-- were missing from the model, so creating a product with an opening batch
-- would be rejected by Prisma at runtime. Both columns are genuine batch
-- domain data (pharmaceutical manufacture date; creator attribution) and are
-- added as nullable so existing batches remain unchanged.
ALTER TABLE "product_batches" ADD COLUMN "manufacture_date" TIMESTAMP(3);
ALTER TABLE "product_batches" ADD COLUMN "created_by" TEXT;
