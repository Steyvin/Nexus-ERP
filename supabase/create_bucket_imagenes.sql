-- ============================================================
-- Crear bucket "imagenes" + políticas de acceso público
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Crear el bucket como público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'imagenes',
  'imagenes',
  true,
  5242880,  -- 5 MB máximo por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Política: cualquier usuario autenticado puede SUBIR imágenes
CREATE POLICY "Usuarios autenticados pueden subir imagenes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'imagenes');

-- 3. Política: cualquiera puede VER las imágenes (es bucket público)
CREATE POLICY "Acceso publico de lectura"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'imagenes');

-- 4. Política: usuarios autenticados pueden ACTUALIZAR sus imágenes
CREATE POLICY "Usuarios autenticados pueden actualizar imagenes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'imagenes');

-- 5. Política: usuarios autenticados pueden ELIMINAR imágenes
CREATE POLICY "Usuarios autenticados pueden eliminar imagenes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'imagenes');
