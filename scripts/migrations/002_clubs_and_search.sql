-- ==========================================================
-- Migration 002: tabela de times + busca normalizada
-- ==========================================================

-- 1. Extensão para remoção de acentos (opcional uso futuro)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ==========================================================
-- 2. Tabela de clubes
-- ==========================================================
CREATE TABLE IF NOT EXISTS clubs (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,   -- "São Paulo"
  slug       TEXT NOT NULL UNIQUE,    -- "sao-paulo"
  name_search TEXT NOT NULL           -- "sao paulo" (normalizado)
);

-- ==========================================================
-- 3. Seed de clubes
-- ==========================================================
INSERT INTO clubs (name, slug, name_search) VALUES
  ('Flamengo',             'flamengo',             'flamengo'),
  ('Fluminense',           'fluminense',           'fluminense'),
  ('Vasco da Gama',        'vasco-da-gama',        'vasco da gama'),
  ('Botafogo',             'botafogo',             'botafogo'),
  ('São Paulo',            'sao-paulo',            'sao paulo'),
  ('Corinthians',          'corinthians',          'corinthians'),
  ('Palmeiras',            'palmeiras',            'palmeiras'),
  ('Santos',               'santos',               'santos'),
  ('Atlético Mineiro',     'atletico-mineiro',     'atletico mineiro'),
  ('Cruzeiro',             'cruzeiro',             'cruzeiro'),
  ('América Mineiro',      'america-mineiro',      'america mineiro'),
  ('Internacional',        'internacional',        'internacional'),
  ('Grêmio',               'gremio',               'gremio'),
  ('Sport Recife',         'sport-recife',         'sport recife'),
  ('Náutico',              'nautico',              'nautico'),
  ('Bahia',                'bahia',                'bahia'),
  ('Vitória',              'vitoria',              'vitoria'),
  ('Fortaleza',            'fortaleza',            'fortaleza'),
  ('Ceará',                'ceara',                'ceara'),
  ('Athletico Paranaense', 'athletico-paranaense', 'athletico paranaense'),
  ('Coritiba',             'coritiba',             'coritiba'),
  ('Goiás',                'goias',                'goias'),
  ('Bragantino',           'bragantino',           'bragantino'),
  ('Cuiabá',               'cuiaba',               'cuiaba'),
  ('Juventude',            'juventude',            'juventude')
ON CONFLICT (slug) DO NOTHING;

-- ==========================================================
-- 4. Índice para busca rápida (SEM função no índice)
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_clubs_name_search
  ON clubs (name_search);

-- ==========================================================
-- 5. (opcional) integração com shirts
-- ==========================================================
-- ALTER TABLE shirts
--   ADD COLUMN club_search TEXT;

-- UPDATE shirts
-- SET club_search = LOWER(unaccent(club));

-- CREATE INDEX idx_shirts_club_search ON shirts (club_search);

-- ALTER TABLE shirts
--   ADD CONSTRAINT fk_shirts_club
--   FOREIGN KEY (club) REFERENCES clubs(name)
--   ON UPDATE CASCADE; 