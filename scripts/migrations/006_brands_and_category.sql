-- ==========================================================
-- Migration 006: brand, club opcional, product_categories
-- ==========================================================

-- 1. Adicionar coluna brand
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;

-- 2. Tornar club opcional (era NOT NULL implicitamente via código)
--    club pode ser NULL para produtos sem clube (tênis, bolas, etc)
ALTER TABLE products ALTER COLUMN club DROP NOT NULL;
ALTER TABLE products ALTER COLUMN club SET DEFAULT NULL;
ALTER TABLE products ALTER COLUMN club_search DROP NOT NULL;
ALTER TABLE products ALTER COLUMN club_search SET DEFAULT NULL;

-- 3. Tabela de categorias personalizadas
--    Guarda categorias fixas + personalizadas pelo admin
CREATE TABLE IF NOT EXISTS product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,   -- 'shirts', 'shoes', 'accessories'
  label       TEXT NOT NULL,          -- 'Camisetas', 'Calçados', 'Acessórios'
  icon        TEXT,                   -- emoji ou nome do ícone: '👕', '👟'
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Seed das categorias padrão
INSERT INTO product_categories (slug, label, icon, sort_order) VALUES
  ('shirts',       'Camisetas',   '👕', 1),
  ('shoes',        'Calçados',    '👟', 2),
  ('combos',       'Combos',      '🎁', 3),
  ('accessories',  'Acessórios',  '🧢', 4)
ON CONFLICT (slug) DO NOTHING;

-- 5. Atualizar tabela products para usar slug da categoria
--    (mantém category como VARCHAR para compatibilidade, mas category_slug é o novo)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_slug TEXT REFERENCES product_categories(slug) ON DELETE SET NULL;

-- Backfill category_slug baseado na category existente
UPDATE products SET category_slug = 'shirts'  WHERE category = 'SHIRT';
UPDATE products SET category_slug = 'shoes'   WHERE category = 'SHOE';
UPDATE products SET category_slug = 'combos'  WHERE category = 'COMBO';

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_category_slug ON products (category_slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_sort ON product_categories (sort_order);

-- 7. Verificação
-- SELECT id, name, club, brand, category, category_slug FROM products LIMIT 5;
-- SELECT * FROM product_categories ORDER BY sort_order;