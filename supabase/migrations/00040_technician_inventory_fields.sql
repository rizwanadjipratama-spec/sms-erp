-- ==============================================================================
-- 00040_technician_inventory_fields.sql
-- Adds technician-specific tracking fields to the products master table
-- ==============================================================================

-- 1. Add fields useful for Technician toolbox tracking
ALTER TABLE products ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT; -- workshop, kantor, or custom
ALTER TABLE products ADD COLUMN IF NOT EXISTS equipment_type TEXT; -- logical type

-- 2. Index the serial_number since it can be searched
CREATE INDEX IF NOT EXISTS idx_products_serial_number ON products(serial_number) WHERE serial_number IS NOT NULL;
