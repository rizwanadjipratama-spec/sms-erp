-- 00041_claims_and_requisitions.sql
-- Employee Claims and Requisitions (Pengajuan) Migration

-- Enable UUID extension if not already enabled (usually is in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types for status, preference, and method
CREATE TYPE company_request_type AS ENUM ('CLAIM', 'REQUISITION');
CREATE TYPE company_request_status AS ENUM (
  'SUBMITTED',     -- Waiting for Owner/Director
  'APPROVED',      -- Approved, waiting for Claim Officer processing
  'REJECTED',      -- Rejected by Owner/Director
  'PENDING',       -- Claim Officer needs an action (partial paid, waiting atm, etc)
  'READY_FOR_CASH',-- Physical cash is ready. Employee must hand over receipt
  'COMPLETED'      -- Fully paid/transferred
);
CREATE TYPE payment_preference_type AS ENUM ('CASH', 'TRANSFER', 'OTHERS');

-- 1. HEADER TABLE
CREATE TABLE IF NOT EXISTS company_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    type company_request_type NOT NULL,
    status company_request_status NOT NULL DEFAULT 'SUBMITTED',
    payment_preference payment_preference_type NOT NULL,
    payment_preference_details TEXT, -- Used if preference is OTHERS or setting bank account
    
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    approved_by UUID REFERENCES auth.users(id),
    approval_date TIMESTAMPTZ,
    approval_note TEXT,
    reject_reason TEXT,
    
    pending_reason TEXT, -- 'uang_belum_ada', 'menunggu_transfer', dll.
    payment_method_offered payment_preference_type, -- If officer negotiates
    post_claim_issue TEXT, -- "bon palsu", dll.
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. LINE ITEMS TABLE
CREATE TABLE IF NOT EXISTS company_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES company_requests(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    unit TEXT,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    price_per_unit NUMERIC(15, 2) NOT NULL,
    total_price NUMERIC(15, 2) NOT NULL,
    receipt_url TEXT, -- URL to Supabase storage if it's a CLAIM
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. AUDIT LOG / HISTORY TABLE
CREATE TABLE IF NOT EXISTS company_request_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES company_requests(id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES auth.users(id) NOT NULL,
    action TEXT NOT NULL, -- e.g. "CREATED", "APPROVED", "PARTIAL_PAYMENT_50K", "ISSUE_FLAGGED"
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Triggers for updated_at
CREATE TRIGGER set_company_requests_updated_at
BEFORE UPDATE ON company_requests
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE company_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_request_history ENABLE ROW LEVEL SECURITY;

-- company_requests policies
CREATE POLICY "Users can view their own requests"
    ON company_requests FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "Users can create requests"
    ON company_requests FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own requests if SUBMITTED or PENDING negotiation"
    ON company_requests FOR UPDATE
    USING (created_by = auth.uid() AND (status = 'SUBMITTED' OR status = 'PENDING' OR status = 'READY_FOR_CASH'));

CREATE POLICY "Approvers and Claim Officers can view all requests"
    ON company_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('owner', 'director', 'claim_officer', 'superadmin', 'admin')
        )
    );

CREATE POLICY "Approvers and Claim Officers can update requests"
    ON company_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('owner', 'director', 'claim_officer', 'superadmin', 'admin')
        )
    );


-- company_request_items policies
CREATE POLICY "Users can view items of requests they can view"
    ON company_request_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM company_requests
            WHERE id = company_request_items.request_id
            AND (
                created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role IN ('owner', 'director', 'claim_officer', 'superadmin', 'admin')
                )
            )
        )
    );

CREATE POLICY "Users can insert items for their own requests"
    ON company_request_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_requests
            WHERE id = company_request_items.request_id AND created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update items for their own SUBMITTED requests"
    ON company_request_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM company_requests
            WHERE id = company_request_items.request_id AND created_by = auth.uid() AND status = 'SUBMITTED'
        )
    );

CREATE POLICY "Users can delete items for their own SUBMITTED requests"
    ON company_request_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM company_requests
            WHERE id = company_request_items.request_id AND created_by = auth.uid() AND status = 'SUBMITTED'
        )
    );

-- company_request_history policies
CREATE POLICY "Anyone can view history of their accessible requests"
    ON company_request_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM company_requests
            WHERE id = company_request_history.request_id
            AND (
                created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role IN ('owner', 'director', 'claim_officer', 'superadmin', 'admin')
                )
            )
        )
    );

CREATE POLICY "Users can insert history"
    ON company_request_history FOR INSERT
    WITH CHECK (actor_id = auth.uid());
