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
  INSERT INTO profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Storage bucket for user photo submissions
-- Run this separately in the SQL Editor:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-submissions', 'user-submissions', true);

-- 5. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for profiles
-- Anyone can read profiles
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 7. RLS Policies for submissions
-- Anyone can read approved submissions (for the gallery)
CREATE POLICY "Anyone can read approved submissions"
  ON submissions FOR SELECT
  USING (status = 'approved');

-- Users can read their own submissions (any status)
CREATE POLICY "Users can read their own submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all submissions
CREATE POLICY "Admins can read all submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Authenticated users can submit photos
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending submissions
CREATE POLICY "Users can update their own pending submissions"
  ON submissions FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can update any submission (to approve/reject)
CREATE POLICY "Admins can update any submission"
  ON submissions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
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
