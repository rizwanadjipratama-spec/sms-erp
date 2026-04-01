-- ==============================================================================
-- PHASE 6: PRICE LIST SYSTEM
-- ==============================================================================
-- Normalizing the pricing model away from hardcoded columns (price_kso, etc.)
-- into a relational Price List -> Items architecture to support unlimited special pricing.

CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('regular', 'kso', 'cpt', 'special')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_lists_branch ON price_lists(branch_id);

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC(15,2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(price_list_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pli_list ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_pli_product ON price_list_items(product_id);

-- Link customers (Profile) to their specific assigned pricing tier
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL;

-- Create default Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_price_lists_updated ON price_lists;
CREATE TRIGGER trig_price_lists_updated BEFORE UPDATE ON price_lists
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trig_price_list_items_updated ON price_list_items;
CREATE TRIGGER trig_price_list_items_updated BEFORE UPDATE ON price_list_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
