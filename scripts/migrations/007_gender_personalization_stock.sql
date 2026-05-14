-- ==========================================================
-- Migration 007: gender + allowPersonalization + infiniteStock + isNew
-- ==========================================================

-- 1. Gênero do produto
CREATE TYPE product_gender AS ENUM ('MASCULINE', 'FEMININE', 'UNISEX');
ALTER TABLE products ADD COLUMN IF NOT EXISTS gender product_gender NOT NULL DEFAULT 'UNISEX';

-- 2. Habilitar/desabilitar personalização por produto
ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_personalization BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Estoque infinito (dropshipping) — ignora stockBySize para cálculo de esgotado
ALTER TABLE products ADD COLUMN IF NOT EXISTS infinite_stock BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Badge "Novo" configurável
--    NULL = usar dias desde criação (padrão 14 dias)
--    TRUE = sempre mostrar badge
--    FALSE = nunca mostrar badge
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new_days INTEGER NOT NULL DEFAULT 14;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_products_gender ON products (gender);
CREATE INDEX IF NOT EXISTS idx_products_allow_personalization ON products (allow_personalization) WHERE allow_personalization = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_infinite_stock ON products (infinite_stock) WHERE infinite_stock = TRUE;

-- 6. Verificação
-- SELECT id, name, gender, allow_personalization, infinite_stock, is_new, is_new_days FROM products LIMIT 3;