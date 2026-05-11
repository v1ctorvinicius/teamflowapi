-- ==========================================================
-- Migration 003: isFeatured + slug para compartilhamento
-- ==========================================================

-- 1. Campo isFeatured: admin empurra produtos com maior margem
ALTER TABLE shirts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Slug: URL amigável para compartilhamento (/produto/flamengo-home-2024)
ALTER TABLE shirts ADD COLUMN IF NOT EXISTS slug TEXT;

-- Gera slugs para produtos existentes a partir do nome
UPDATE shirts
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(name,
        'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
        'aaaaaaeeeeiiiiooooouuuuucAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Garante unicidade e NOT NULL depois do backfill
ALTER TABLE shirts ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shirts_slug ON shirts (slug);

-- 3. Índice para featured (queries da seção de destaques)
CREATE INDEX IF NOT EXISTS idx_shirts_featured ON shirts (is_featured) WHERE is_featured = TRUE;

-- 4. Expõe campo no AdminView para toggle (não precisa de migration extra)
-- COMO USAR:
--   UPDATE shirts SET is_featured = TRUE WHERE id = '...';
--   Ou via PATCH /admin/products/:id  { "isFeatured": true }
