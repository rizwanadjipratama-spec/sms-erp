-- ==============================================================================
-- PHASE 9: AUDIT LOG (COMPREHENSIVE TRIGGER TRACKING)
-- ==============================================================================
-- Uses the audit_logs table created in Phase 1 (00029) to automatically log
-- all DML changes on mission-critical tables without relying on JS-layer calls.

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
    v_record_id UUID;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.id;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.id;
    END IF;

    -- Avoid logging if no actual data changed during UPDATE
    IF TG_OP = 'UPDATE' AND v_old_data = v_new_data THEN
        RETURN NEW;
    END IF;

    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME::TEXT, 
        v_record_id, 
        TG_OP::TEXT, 
        v_old_data, 
        v_new_data, 
        auth.uid()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to mission critical tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['products', 'requests', 'invoices', 'delivery_logs', 'financial_transactions', 'service_issues', 'stock_transfers', 'purchase_orders'])
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS trig_audit_log_' || t || ' ON ' || t;
        EXECUTE 'CREATE TRIGGER trig_audit_log_' || t || '
                 AFTER INSERT OR UPDATE OR DELETE ON ' || t || '
                 FOR EACH ROW EXECUTE FUNCTION fn_audit_log()';
    END LOOP;
END;
$$;
