-- Supabase local development seed data.
-- Run automatically after migrations during `supabase db reset`.
--
-- Storage buckets must be created here so they survive `db reset` cycles.
-- The config.toml [storage.buckets.*] declarations apply on fresh starts;
-- this file ensures the rows exist after any reset.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('plant-photos',          'plant-photos',          false, 5242880,   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('plant-thumbnails',      'plant-thumbnails',      false, 2097152,   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('data-exports',          'data-exports',          false, 104857600, ARRAY['application/zip', 'application/json']),
  ('identification-photos', 'identification-photos', false, 5242880,   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
