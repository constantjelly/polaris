-- ==========================================================
-- POLARIS — Database Schema for Forums (Profiles + Submissions)
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/nflnjhcyrdjayvjpmyaf/sql/new)
-- ==========================================================

-- 1. Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Submissions table (user-uploaded sky photos)
CREATE TABLE IF NOT EXISTS submissions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ
);

-- 3. Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Storage bucket for user photo submissions
INSERT INTO storage.buckets (id, name, public) VALUES ('user-submissions', 'user-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Public buckets are readable, but uploads still need storage.objects RLS.
DROP POLICY IF EXISTS "Anyone can read user submission files" ON storage.objects;
CREATE POLICY "Anyone can read user submission files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-submissions');

DROP POLICY IF EXISTS "Users can upload their own submission files" ON storage.objects;
CREATE POLICY "Users can upload their own submission files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for profiles
DROP POLICY IF EXISTS "Profiles are publicly readable" ON profiles;
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING ((current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid = id);

-- 7. RLS Policies for submissions
-- NOTE: auth.uid() can be unreliable in static-site contexts, so we use
--       current_setting('request.jwt.claims') to read the JWT directly.
DROP POLICY IF EXISTS "Anyone can read approved submissions" ON submissions;
CREATE POLICY "Anyone can read approved submissions"
  ON submissions FOR SELECT
  USING (status = 'approved');

DROP POLICY IF EXISTS "Users can read their own submissions" ON submissions;
CREATE POLICY "Users can read their own submissions"
  ON submissions FOR SELECT
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid = user_id
  );

DROP POLICY IF EXISTS "Admins can read all submissions" ON submissions;
CREATE POLICY "Admins can read all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
        AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can create submissions" ON submissions;
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid = user_id
  );

DROP POLICY IF EXISTS "Users can update their own pending submissions" ON submissions;
CREATE POLICY "Users can update their own pending submissions"
  ON submissions FOR UPDATE
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid = user_id
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Admins can update any submission" ON submissions;
CREATE POLICY "Admins can update any submission"
  ON submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
        AND is_admin = true
    )
  );

-- Users can delete their own pending submissions
DROP POLICY IF EXISTS "Users can delete their own pending submissions" ON submissions;
CREATE POLICY "Users can delete their own pending submissions"
  ON submissions FOR DELETE
  USING (
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid = user_id
    AND status = 'pending'
  );

-- 8. How to make yourself an admin:
-- After signing in with Google once, find your user ID in Supabase Auth > Users,
-- then run:
-- UPDATE profiles SET is_admin = true WHERE id = 'your-user-uuid';

-- 9. Enable Google Auth:
-- Go to Supabase Dashboard > Authentication > Providers > Google
-- Enable it and add your Google Cloud OAuth credentials.
-- Also set Site URL to your Vercel domain and add redirect URLs:
--   https://your-domain.vercel.app/join.html
