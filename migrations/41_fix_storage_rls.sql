-- Fix for Storage RLS Policies
-- This migration fixes the "new row violates row-level security policy" error when uploading avatars.

-- 1. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can select their own avatar" ON storage.objects;

-- 2. Allow users to upload (INSERT) their own avatar
-- We use TO authenticated to ensure only logged in users can upload
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Allow users to update (UPDATE) their own avatar
-- Upsert requires both USING and WITH CHECK to work correctly
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Allow users to delete (DELETE) their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Allow public access to read (SELECT) avatars
-- Since the bucket is public, this is mostly for the API to work smoothly
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
