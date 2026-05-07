DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'Skipping Storage bucket migration because storage.buckets does not exist in this database.';
    RETURN;
  END IF;

  EXECUTE $storage_buckets$
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('plant-photos', 'plant-photos', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']::text[]),
      ('plant-thumbnails', 'plant-thumbnails', false, 2097152, ARRAY['image/jpeg','image/png','image/webp']::text[]),
      ('data-exports', 'data-exports', false, 104857600, ARRAY['application/zip','application/json']::text[])
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types
  $storage_buckets$;
END $$;
