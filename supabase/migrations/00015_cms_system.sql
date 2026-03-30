-- ============================================================================
-- 00015: CMS FULL CONTROL SYSTEM
-- Adds tables for global settings, news, events, and partners management.
-- ============================================================================

-- 1. CMS Settings (Singleton)
CREATE TABLE IF NOT EXISTS public.cms_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    
    -- Hero Section
    hero_title text,
    hero_subtitle text,
    hero_image_url text,
    hero_video_url text,
    
    -- About Section
    about_heading text,
    about_text text,
    about_image_url text,
    
    -- Announcements
    announcement_text text,
    announcement_link text,
    announcement_is_active boolean DEFAULT false,
    
    -- Company Info
    company_name text,
    company_address text,
    company_phone text,
    company_email text,
    
    -- Employee of the month
    employee_of_month_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. CMS News
CREATE TABLE IF NOT EXISTS public.cms_news (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    content text NOT NULL,
    image_url text,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET DEFAULT,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3. CMS Events
CREATE TABLE IF NOT EXISTS public.cms_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    description text NOT NULL,
    image_url text,
    event_date timestamp with time zone NOT NULL,
    location text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET DEFAULT,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER set_updated_at_cms_settings
    BEFORE UPDATE ON public.cms_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_cms_news
    BEFORE UPDATE ON public.cms_news
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_cms_events
    BEFORE UPDATE ON public.cms_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- RLS POLICIES
-- Read access is public (true) so the landing page can fetch anonymously.
-- Write access is restricted to admin and owner roles.
-- ============================================================================
ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_events ENABLE ROW LEVEL SECURITY;

-- CMS Settings Policies
CREATE POLICY "Public Read Access on cms_settings"
    ON public.cms_settings FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Admin/Owner Full Access on cms_settings"
    ON public.cms_settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- CMS News Policies
CREATE POLICY "Public Read Access on cms_news"
    ON public.cms_news FOR SELECT
    TO public
    USING (true); -- Front-end may want to filter WHERE is_published = true, but DB allows reading all.

CREATE POLICY "Admin/Owner Full Access on cms_news"
    ON public.cms_news FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- CMS Events Policies
CREATE POLICY "Public Read Access on cms_events"
    ON public.cms_events FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Admin/Owner Full Access on cms_events"
    ON public.cms_events FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ============================================================================
-- INITIAL SEED (Ensure row with id=1 exists)
-- ============================================================================
INSERT INTO public.cms_settings (id, company_name) 
VALUES (1, 'PT Sarana Megamedilab Sejahtera') 
ON CONFLICT (id) DO NOTHING;
