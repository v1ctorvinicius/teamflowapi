-- ==========================================================
-- Migration 005: Expandir users + adicionar wishlist + addresses
-- ==========================================================

-- 1. Expandir tabela users com novos campos
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_number VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_state VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_country VARCHAR(100) DEFAULT 'Brasil';

-- 2. Criar tabela de wishlist (produtos favoritos)
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist(product_id);

-- 3. Índices úteis
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);