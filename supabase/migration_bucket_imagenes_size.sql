-- ═════════════════════════════════════════════════════════════════════════════
--  MIGRATION: subir el límite de tamaño del bucket "imagenes"
--  Ejecutar en Supabase SQL Editor.
--  Las imágenes que devuelve Magnific/Mystic superan el límite original de 5MB.
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET file_size_limit = 52428800  -- 50 MB
WHERE id = 'imagenes';
