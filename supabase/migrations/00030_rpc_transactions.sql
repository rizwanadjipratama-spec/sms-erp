-- ==============================================================================
-- PHASE 3: TRANSACTION RPC FUNCTIONS
-- ==============================================================================
-- This migration implements atomic Postgres functions to replace multi-step
-- Application/JS layer orchestrations. This guarantees ACID compliance.

-- 1. prepare_order_stock
-- Transitions order from 'invoice_ready' to 'preparing' and deducts stock safely.
CREATE OR REPLACE FUNCTION rpc_prepare_order_stock(p_order_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item RECORD;
    v_branch_id UUID;
    v_current_status TEXT;
BEGIN
    -- 1. Lock the request row and verify status
    SELECT status, branch_id INTO v_current_status, v_branch_id 
    FROM requests WHERE id = p_order_id FOR UPDATE;

    IF v_current_status != 'invoice_ready' THEN
        RAISE EXCEPTION 'Order status must be invoice_ready, current status is %', v_current_status;
    END IF;

    -- 2. Loop through request items and deduct stock
    FOR v_item IN SELECT product_id, quantity FROM request_items WHERE request_id = p_order_id LOOP
        -- Deduct from generic stock (legacy)
        UPDATE products 
        SET stock = stock - v_item.quantity 
        WHERE id = v_item.product_id;

        -- Deduct from branch-specific stock
        IF v_branch_id IS NOT NULL THEN
            UPDATE product_branch_stock
            SET stock = stock - v_item.quantity
            WHERE product_id = v_item.product_id AND branch_id = v_branch_id;
        END IF;

        -- Log movement
        INSERT INTO inventory_logs (product_id, order_id, change, balance, movement_type, reason, created_by)
        VALUES (
            v_item.product_id, 
            p_order_id, 
            -(v_item.quantity), 
            (SELECT stock FROM products WHERE id = v_item.product_id), -- simplified balance 
            'SALES_OUT'::inventory_movement_type, 
            'Stock consumed for order ' || p_order_id, 
            p_user_id
        );
    END LOOP;

    -- 3. Update order status
    UPDATE requests SET status = 'preparing', updated_at = NOW() WHERE id = p_order_id;
    
    RETURN TRUE;
END;
$$;

-- 2. create_invoice
-- Transitions order to invoice_ready and generates the invoice record cleanly
CREATE OR REPLACE FUNCTION rpc_create_invoice(p_order_id UUID, p_user_id UUID, p_total NUMERIC, p_tax NUMERIC)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_invoice_id UUID;
    v_branch_id UUID;
    v_current_status TEXT;
BEGIN
    SELECT status, branch_id INTO v_current_status, v_branch_id 
    FROM requests WHERE id = p_order_id FOR UPDATE;

    IF v_current_status != 'approved' THEN
        RAISE EXCEPTION 'Order must be approved before invoice creation.';
    END IF;

    -- Create Invoice
    INSERT INTO invoices (request_id, branch_id, status, amount, tax_amount, created_by)
    VALUES (p_order_id, v_branch_id, 'issued', p_total, p_tax, p_user_id)
    RETURNING id INTO v_invoice_id;

    -- Update Order
    UPDATE requests SET status = 'invoice_ready', updated_at = NOW() WHERE id = p_order_id;

    RETURN v_invoice_id;
END;
$$;


-- 3. complete_delivery
-- Finishes the delivery log and transitions the parent origin
CREATE OR REPLACE FUNCTION rpc_complete_delivery(p_delivery_id UUID, p_user_id UUID, p_proof_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_order_id UUID;
BEGIN
    -- Update delivery
    UPDATE delivery_logs 
    SET status = 'completed', photo_url = p_proof_url, updated_at = NOW()
    WHERE id = p_delivery_id OR id::text = p_delivery_id::text
    RETURNING request_id INTO v_order_id;

    IF v_order_id IS NOT NULL THEN
        UPDATE requests SET status = 'delivered', updated_at = NOW() WHERE id = v_order_id;
    END IF;
    
    RETURN TRUE;
END;
$$;


-- 4. execute_stock_transfer
-- Atomically moves stock between two branches
CREATE OR REPLACE FUNCTION rpc_execute_stock_transfer(p_transfer_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;

    IF v_transfer.status != 'approved' THEN
        RAISE EXCEPTION 'Transfer must be approved before execution.';
    END IF;

    FOR v_item IN SELECT product_id, quantity FROM stock_transfer_items WHERE transfer_id = p_transfer_id LOOP
        -- Deduct Source
        UPDATE product_branch_stock SET stock = stock - v_item.quantity 
        WHERE product_id = v_item.product_id AND branch_id = v_transfer.from_branch_id;

        INSERT INTO inventory_logs (product_id, change, balance, movement_type, reason, created_by)
        VALUES (v_item.product_id, -(v_item.quantity), 0, 'TRANSFER_OUT'::inventory_movement_type, 'Transfer outbound ' || p_transfer_id, p_user_id);

        -- Increment Destination
        UPDATE product_branch_stock SET stock = stock + v_item.quantity 
        WHERE product_id = v_item.product_id AND branch_id = v_transfer.to_branch_id;

        INSERT INTO inventory_logs (product_id, change, balance, movement_type, reason, created_by)
        VALUES (v_item.product_id, v_item.quantity, 0, 'TRANSFER_IN'::inventory_movement_type, 'Transfer inbound ' || p_transfer_id, p_user_id);
    END LOOP;

    -- Mark shipped/received
    UPDATE stock_transfers SET status = 'completed', updated_at = NOW() WHERE id = p_transfer_id;

    RETURN TRUE;
END;
$$;

-- 5. receive_purchase_order
CREATE OR REPLACE FUNCTION rpc_receive_purchase_order(p_po_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;

    IF v_po.status = 'received' THEN
        RAISE EXCEPTION 'PO is already received.';
    END IF;

    FOR v_item IN SELECT product_id, quantity FROM purchase_order_items WHERE po_id = p_po_id LOOP
        IF v_po.branch_id IS NOT NULL THEN
            UPDATE product_branch_stock SET stock = stock + v_item.quantity 
            WHERE product_id = v_item.product_id AND branch_id = v_po.branch_id;
        END IF;

        UPDATE products SET stock = stock + v_item.quantity WHERE id = v_item.product_id;

        INSERT INTO inventory_logs (product_id, change, balance, movement_type, reason, created_by)
        VALUES (v_item.product_id, v_item.quantity, 0, 'PURCHASE_IN'::inventory_movement_type, 'PO Received ' || p_po_id, p_user_id);
    END LOOP;

    UPDATE purchase_orders SET status = 'received', updated_at = NOW() WHERE id = p_po_id;

    RETURN TRUE;
END;
$$;
