-- migrations/001_initial_schema.sql
-- TeamFlow MVP — Initial Schema + Seed Data

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUM types
-- ─────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN', 'AFFILIATE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shirt_type AS ENUM ('PLAYER', 'FAN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shirt_size AS ENUM ('PP','P', 'M', 'G', 'GG', 'XGG', '2GG', '3GG', '4GG');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  favorite_team  TEXT,
  role           user_role NOT NULL DEFAULT 'CUSTOMER',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─────────────────────────────────────────────
-- refresh_tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);

-- ─────────────────────────────────────────────
-- shirts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shirts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  club               TEXT NOT NULL,
  club_search        TEXT NOT NULL DEFAULT '',   -- 🔥 busca normalizada
  season             TEXT NOT NULL,
  type               shirt_type NOT NULL,
  sizes              shirt_size[] NOT NULL DEFAULT '{}',
  base_price         INTEGER NOT NULL CHECK (base_price >= 0),
  description        TEXT,
  image_url          TEXT,
  supplier_metadata  JSONB NOT NULL DEFAULT '{}',
  stock_by_size      JSONB NOT NULL DEFAULT '{}',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shirts_club ON shirts (club);
CREATE INDEX IF NOT EXISTS idx_shirts_season ON shirts (season);
CREATE INDEX IF NOT EXISTS idx_shirts_type ON shirts (type);
CREATE INDEX IF NOT EXISTS idx_shirts_is_active ON shirts (is_active);

-- ─────────────────────────────────────────────
-- squad_restrictions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS squad_restrictions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id      TEXT NOT NULL,
  player_name  TEXT NOT NULL,
  number       INT NOT NULL CHECK (number >= 0 AND number <= 99),
  UNIQUE (club_id, player_name, number)
);

CREATE INDEX IF NOT EXISTS idx_squad_restrictions_club ON squad_restrictions (club_id);

-- ─────────────────────────────────────────────
-- carts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- cart_items
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id           UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES shirts (id),
  size              shirt_size NOT NULL,
  quantity          INT NOT NULL CHECK (quantity > 0),
  personalization   JSONB,
  idempotency_key   TEXT NOT NULL,
  unit_price_cents  INT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, idempotency_key)
);

-- ─────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────

-- helper mental: club_search = lowercase sem acento

INSERT INTO shirts (
  id, name, club, club_search, season, type, sizes,
  base_price, description, image_url, stock_by_size
)
SELECT * FROM (VALUES
(
  '11111111-1111-1111-1111-111111111111'::UUID,
  'Flamengo Home Jersey 2024',
  'Flamengo',
  'flamengo',
  '2024',
  'PLAYER'::shirt_type,
  ARRAY['P','M','G','GG']::shirt_size[],
  34990,
  'Official Flamengo home jersey for 2024 season.',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500',
  '{"P":50,"M":80,"G":60,"GG":30}'::JSONB
)) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM shirts WHERE id = '11111111-1111-1111-1111-111111111111'
);

INSERT INTO shirts (
  id, name, club, club_search, season, type, sizes,
  base_price, description, image_url, stock_by_size
)
SELECT * FROM (VALUES
(
  '22222222-2222-2222-2222-222222222222'::UUID,
  'Flamengo Away Jersey 2024',
  'Flamengo',
  'flamengo',
  '2024',
  'PLAYER'::shirt_type,
  ARRAY['P','M','G','GG']::shirt_size[],
  34990,
  'Official away jersey.',
  'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=500',
  '{"P":40,"M":70,"G":50,"GG":25}'::JSONB
)) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM shirts WHERE id = '22222222-2222-2222-2222-222222222222'
);

INSERT INTO shirts (
  id, name, club, club_search, season, type, sizes,
  base_price, description, image_url, stock_by_size
)
SELECT * FROM (VALUES
(
  '33333333-3333-3333-3333-333333333333'::UUID,
  'Flamengo Fan Edition 2024',
  'Flamengo',
  'flamengo',
  '2024',
  'FAN'::shirt_type,
  ARRAY['P','M','G','GG','XGG']::shirt_size[],
  19990,
  'Fan version jersey.',
  'https://images.unsplash.com/photo-1599127106259-7c1f1a56ef0b?w=500',
  '{"P":100,"M":150,"G":120,"GG":80,"XGG":40}'::JSONB
)) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM shirts WHERE id = '33333333-3333-3333-3333-333333333333'
);

-- Corinthians
INSERT INTO shirts (
  id, name, club, club_search, season, type, sizes,
  base_price, description, image_url, stock_by_size
)
SELECT * FROM (VALUES
(
  '44444444-4444-4444-4444-444444444444'::UUID,
  'Corinthians Home Jersey 2024',
  'Corinthians',
  'corinthians',
  '2024',
  'PLAYER'::shirt_type,
  ARRAY['P','M','G','GG']::shirt_size[],
  34990,
  'Official Corinthians jersey.',
  'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=500',
  '{"P":45,"M":75,"G":55,"GG":35}'::JSONB
)) AS v
WHERE NOT EXISTS (
  SELECT 1 FROM shirts WHERE id = '44444444-4444-4444-4444-444444444444'
);

-- squad restrictions (mantido igual)
INSERT INTO squad_restrictions (club_id, player_name, number)
SELECT * FROM (VALUES
  ('Flamengo','Arrascaeta',14),
  ('Flamengo','Pedro',9),
  ('Corinthians','Cassio',12),
  ('Corinthians','Fagner',23)
) AS v(club_id, player_name, number)
WHERE NOT EXISTS (
  SELECT 1 FROM squad_restrictions
  WHERE club_id = v.club_id
  AND player_name = v.player_name
  AND number = v.number
);