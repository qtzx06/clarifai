-- Clarifai Database Schema for Supabase PostgreSQL
-- Run this in Supabase SQL Editor after creating your project

-- Create enum types
CREATE TYPE analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE video_status AS ENUM ('not_started', 'generating', 'completed', 'failed');

-- Users table (extends Supabase auth.users)
-- Note: Supabase auth.users already exists, we just reference it
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    google_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own data
CREATE POLICY "Users can view own data"
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- Papers table
CREATE TABLE IF NOT EXISTS public.papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT '',
    authors TEXT[] DEFAULT ARRAY[]::TEXT[],
    abstract TEXT DEFAULT '',
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    analysis_status analysis_status DEFAULT 'pending' NOT NULL,
    video_status video_status DEFAULT 'not_started' NOT NULL,
    content TEXT DEFAULT '',
    full_analysis TEXT DEFAULT '',
    methodology TEXT DEFAULT '',
    insights TEXT[] DEFAULT ARRAY[]::TEXT[],
    video_path TEXT,
    clips_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_papers_user_id ON public.papers(user_id);
CREATE INDEX idx_papers_upload_time ON public.papers(upload_time DESC);

-- Enable RLS
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own papers
CREATE POLICY "Users can view own papers"
ON public.papers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own papers"
ON public.papers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own papers"
ON public.papers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own papers"
ON public.papers FOR DELETE
USING (auth.uid() = user_id);

-- Concepts table
CREATE TABLE IF NOT EXISTS public.concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    importance_score FLOAT DEFAULT 0.0,
    concept_type TEXT DEFAULT 'conceptual',
    page_numbers INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    text_snippets TEXT[] DEFAULT ARRAY[]::TEXT[],
    related_concepts TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT fk_paper FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_concepts_paper_id ON public.concepts(paper_id);

-- Enable RLS
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access concepts for their own papers
CREATE POLICY "Users can view concepts for own papers"
ON public.concepts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.papers
        WHERE papers.id = concepts.paper_id
        AND papers.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert concepts for own papers"
ON public.concepts FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.papers
        WHERE papers.id = concepts.paper_id
        AND papers.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update concepts for own papers"
ON public.concepts FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.papers
        WHERE papers.id = concepts.paper_id
        AND papers.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete concepts for own papers"
ON public.concepts FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.papers
        WHERE papers.id = concepts.paper_id
        AND papers.user_id = auth.uid()
    )
);

-- Video Generations table (for tracking and rate limiting)
CREATE TABLE IF NOT EXISTS public.video_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
    concept_name TEXT NOT NULL,
    status video_status DEFAULT 'generating' NOT NULL,
    video_url TEXT,
    clips_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
    captions JSONB DEFAULT '[]'::JSONB,
    logs TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_paper FOREIGN KEY (paper_id) REFERENCES public.papers(id) ON DELETE CASCADE,
    CONSTRAINT fk_concept FOREIGN KEY (concept_id) REFERENCES public.concepts(id) ON DELETE CASCADE
);

-- Indexes for rate limiting queries
CREATE INDEX idx_video_generations_user_id ON public.video_generations(user_id);
CREATE INDEX idx_video_generations_created_at ON public.video_generations(created_at DESC);
CREATE INDEX idx_video_generations_user_date ON public.video_generations(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view own video generations"
ON public.video_generations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video generations"
ON public.video_generations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video generations"
ON public.video_generations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own video generations"
ON public.video_generations FOR DELETE
USING (auth.uid() = user_id);

-- Function to get video generation count for today
CREATE OR REPLACE FUNCTION get_daily_video_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.video_generations
    WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE;

    RETURN v_count;
END;
$$;

-- Trigger to automatically create user row when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        NOW()
    );
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE public.users IS 'Extended user profile data linked to Supabase auth';
COMMENT ON TABLE public.papers IS 'Research papers uploaded by users';
COMMENT ON TABLE public.concepts IS 'Key concepts extracted from papers';
COMMENT ON TABLE public.video_generations IS 'Video generation tracking and history';
COMMENT ON FUNCTION get_daily_video_count IS 'Returns count of videos generated today by user (for rate limiting)';
