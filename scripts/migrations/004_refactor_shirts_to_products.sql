-- ==========================================================
-- Migration 004: Refactor shirts → products + sistemas de tamanho
-- ==========================================================

-- ==========================================================
-- 1. Renomear tabela
-- ==========================================================

ALTER TABLE shirts RENAME TO products;

-- ==========================================================
-- 2. Categoria do produto
-- ==========================================================

ALTER TABLE products
ADD COLUMN category VARCHAR NOT NULL DEFAULT 'SHIRT';

-- ==========================================================
-- 3. Sistema de tamanhos categóricos
-- ==========================================================

ALTER TABLE products
ADD COLUMN enable_categorical_sizes BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN categorical_sizes_label VARCHAR NOT NULL DEFAULT 'Tamanho';

-- ==========================================================
-- 4. Sistema de tamanhos numéricos
-- ==========================================================

ALTER TABLE products
ADD COLUMN enable_numeric_sizes BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN numeric_sizes_label VARCHAR NOT NULL DEFAULT 'Tamanho';

ALTER TABLE products
ADD COLUMN stock_numeric JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ==========================================================
-- 5. Renomear estruturas antigas
-- ==========================================================

ALTER TABLE products
RENAME COLUMN sizes TO stock_categorical;

ALTER TABLE products
RENAME COLUMN stock_by_size TO stock_categorical_by_size;

-- ==========================================================
-- 6. Suporte a múltiplas imagens
-- ==========================================================

ALTER TABLE products
ADD COLUMN image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill automático da imagem antiga
UPDATE products
SET image_urls = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL;

-- ==========================================================
-- 7. Backfill categoria
-- ==========================================================

UPDATE products
SET category = 'SHIRT'
WHERE category IS NULL;

-- ==========================================================
-- 8. Índices
-- ==========================================================

DROP INDEX IF EXISTS idx_shirts_featured;
DROP INDEX IF EXISTS idx_shirts_club_search;
DROP INDEX IF EXISTS idx_shirts_slug;

CREATE INDEX idx_products_featured
ON products (is_featured)
WHERE is_featured = TRUE;

-- Busca normalizada já pronta via coluna materializada
CREATE INDEX idx_products_club_search
ON products (club_search);

CREATE UNIQUE INDEX idx_products_slug
ON products (slug);

CREATE INDEX idx_products_category
ON products (category);