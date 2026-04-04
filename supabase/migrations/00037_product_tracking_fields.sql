-- 00037: Add NIE, LOT, and Expiry tracking fields to products
-- NIE = Nomor Izin Edar (product registration number)
-- LOT = batch/lot number
-- expiry_date = product expiry date

ALTER TABLE products ADD COLUMN IF NOT EXISTS nie TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;

COMMENT ON COLUMN products.nie IS 'Nomor Izin Edar – product registration number';
COMMENT ON COLUMN products.lot_number IS 'Batch / LOT number';
COMMENT ON COLUMN products.expiry_date IS 'Product expiry date';
