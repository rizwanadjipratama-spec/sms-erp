-- Add new technician-specific categories to the globally defined product_category Enum
-- Use IF NOT EXISTS to ensure idempotency

-- WARNING: ALTER TYPE statements cannot run inside a transaction block if the type was created in the same transaction.
-- But since it's an existing type, we can alter it safely.

DO $$
BEGIN
    -- ADD 'Spare Parts'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'product_category'::regtype 
        AND enumlabel = 'Spare Parts'
    ) THEN
        ALTER TYPE product_category ADD VALUE 'Spare Parts';
    END IF;

    -- ADD 'Tools'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'product_category'::regtype 
        AND enumlabel = 'Tools'
    ) THEN
        ALTER TYPE product_category ADD VALUE 'Tools';
    END IF;

    -- ADD 'Filters'
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'product_category'::regtype 
        AND enumlabel = 'Filters'
    ) THEN
        ALTER TYPE product_category ADD VALUE 'Filters';
    END IF;
END $$;
