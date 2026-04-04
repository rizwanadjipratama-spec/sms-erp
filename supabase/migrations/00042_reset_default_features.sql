-- ============================================================================
-- POPULATE DEFAULT SIDEBAR FEATURES PER ROLE
-- Sets the correct default features for every user based on their role.
-- Users who already have custom features (>1 item, set by Owner) are NOT touched.
-- Standard for ALL employee roles: COMPANY, CLAIMS, TIME_OFF, ATTENDANCE, MY_PROFILE
-- ============================================================================

-- Client defaults
UPDATE profiles SET features = ARRAY['CLIENT_ORDERS','CLIENT_NEW_REQUEST','CLIENT_PRODUCTS','CLIENT_ISSUES','MY_PROFILE']::text[]
WHERE role = 'client' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Marketing defaults
UPDATE profiles SET features = ARRAY['COMPANY','MARKETING','MARKETING_CLIENTS','PRICE_LIST','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'marketing' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Boss defaults
UPDATE profiles SET features = ARRAY['COMPANY','APPROVALS','PR_APPROVALS','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'boss' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Finance defaults
UPDATE profiles SET features = ARRAY['COMPANY','FINANCE','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'finance' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Warehouse defaults
UPDATE profiles SET features = ARRAY['COMPANY','WAREHOUSE','INVENTORY','CATALOG','CREATE_PR','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'warehouse' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Technician defaults
UPDATE profiles SET features = ARRAY['COMPANY','DELIVERY','MY_INVENTORY','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'technician' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Courier defaults
UPDATE profiles SET features = ARRAY['COMPANY','COURIER','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'courier' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Faktur defaults
UPDATE profiles SET features = ARRAY['COMPANY','FINANCE','CATALOG','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'faktur' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Admin defaults
UPDATE profiles SET features = ARRAY['COMPANY','ADMIN_PANEL','USERS','REPORTS','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'admin' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Owner defaults (ALL non-client features)
UPDATE profiles SET features = ARRAY['COMPANY','MARKETING','MARKETING_CLIENTS','PRICE_LIST','APPROVALS','FINANCE','WAREHOUSE','INVENTORY','CATALOG','CREATE_PR','PR_APPROVALS','DELIVERY','MY_INVENTORY','COURIER','TAX_REPORTS','ANALYTICS','REPORTS','DIRECTOR_OVERVIEW','ADMIN_PANEL','CLAIMS','CLAIM_APPROVALS','DISBURSEMENTS','TIME_OFF','ATTENDANCE','CMS','USERS','MY_PROFILE']::text[]
WHERE role = 'owner' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Director defaults
UPDATE profiles SET features = ARRAY['COMPANY','DIRECTOR_OVERVIEW','APPROVALS','PR_APPROVALS','CLAIM_APPROVALS','ANALYTICS','REPORTS','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'director' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Tax defaults
UPDATE profiles SET features = ARRAY['COMPANY','TAX_REPORTS','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'tax' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Manager defaults
UPDATE profiles SET features = ARRAY['COMPANY','APPROVALS','REPORTS','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'manager' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Purchasing defaults
UPDATE profiles SET features = ARRAY['COMPANY','CREATE_PR','CATALOG','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'purchasing' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);

-- Claim Officer defaults
UPDATE profiles SET features = ARRAY['COMPANY','DISBURSEMENTS','CLAIMS','TIME_OFF','ATTENDANCE','MY_PROFILE']::text[]
WHERE role = 'claim_officer' AND (features IS NULL OR array_length(features, 1) IS NULL OR array_length(features, 1) <= 1);
