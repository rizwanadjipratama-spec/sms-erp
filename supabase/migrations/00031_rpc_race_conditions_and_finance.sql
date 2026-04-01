-- ==============================================================================
-- PHASE 3 & 4: TRANSACTION RPC FUNCTIONS & RACE CONDITION FIXES
-- ==============================================================================

-- 6. technician_take_job
-- Prevents two technicians from claiming the same job simultaneously
CREATE OR REPLACE FUNCTION rpc_technician_take_job(p_issue_id UUID, p_tech_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    UPDATE service_issues
    SET assigned_to = p_tech_id, status = 'otw', updated_at = NOW()
    WHERE id = p_issue_id AND assigned_to IS NULL
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RAISE EXCEPTION 'Job is already assigned or does not exist.';
    END IF;

    RETURN TRUE;
END;
$$;

-- 7. courier_take_delivery
CREATE OR REPLACE FUNCTION rpc_courier_take_delivery(p_delivery_id UUID, p_courier_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_updated_id UUID;
    v_order_id UUID;
BEGIN
    UPDATE delivery_logs
    SET courier_id = p_courier_id, status = 'otw', updated_at = NOW()
    WHERE id = p_delivery_id AND courier_id IS NULL
    RETURNING id, request_id INTO v_updated_id, v_order_id;

    IF v_updated_id IS NULL THEN
        RAISE EXCEPTION 'Delivery is already assigned or does not exist.';
    END IF;

    IF v_order_id IS NOT NULL THEN
        UPDATE requests SET status = 'on_delivery', updated_at = NOW() WHERE id = v_order_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- 8. pay_supplier_invoice
CREATE OR REPLACE FUNCTION rpc_pay_supplier_invoice(p_invoice_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT * INTO v_inv FROM supplier_invoices WHERE id = p_invoice_id FOR UPDATE;

    IF v_inv.status = 'paid' THEN
        RAISE EXCEPTION 'Invoice is already paid.';
    END IF;

    UPDATE supplier_invoices SET status = 'paid', updated_at = NOW() WHERE id = p_invoice_id;

    INSERT INTO financial_transactions (branch_id, type, category, amount, reference_id, created_by, description)
    VALUES (v_inv.branch_id, 'OUTFLOW', 'supplier_payment', v_inv.total_amount, p_invoice_id, p_user_id, 'Paid supplier invoice ' || p_invoice_id);

    RETURN TRUE;
END;
$$;

-- 9. pay_expense_claim
CREATE OR REPLACE FUNCTION rpc_pay_expense_claim(p_claim_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_claim RECORD;
BEGIN
    SELECT * INTO v_claim FROM expense_claims WHERE id = p_claim_id FOR UPDATE;

    IF v_claim.status = 'paid' THEN
        RAISE EXCEPTION 'Claim is already paid.';
    END IF;

    UPDATE expense_claims SET status = 'paid', updated_at = NOW() WHERE id = p_claim_id;

    INSERT INTO financial_transactions (branch_id, type, category, amount, reference_id, created_by, description)
    VALUES (v_claim.branch_id, 'OUTFLOW', 'expense_claim', v_claim.total_amount, p_claim_id, p_user_id, 'Paid expense claim ' || p_claim_id);

    RETURN TRUE;
END;
$$;

-- 10. monthly_closing
CREATE OR REPLACE FUNCTION rpc_monthly_closing(p_branch_id UUID, p_month TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_inflow NUMERIC := 0;
    v_outflow NUMERIC := 0;
BEGIN
    -- This assumes p_month is in 'YYYY-MM' format
    SELECT COALESCE(SUM(amount), 0) INTO v_inflow 
    FROM financial_transactions 
    WHERE branch_id = p_branch_id AND type = 'INFLOW' AND to_char(created_at, 'YYYY-MM') = p_month;

    SELECT COALESCE(SUM(amount), 0) INTO v_outflow 
    FROM financial_transactions 
    WHERE branch_id = p_branch_id AND type = 'OUTFLOW' AND to_char(created_at, 'YYYY-MM') = p_month;

    INSERT INTO monthly_closing (branch_id, month, total_revenue, total_expense, closed_by)
    VALUES (p_branch_id, p_month, v_inflow, v_outflow, p_user_id);

    RETURN TRUE;
END;
$$;
