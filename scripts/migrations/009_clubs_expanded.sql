-- ==========================================================
-- Migration 009: Expandir tabela clubs
-- ==========================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS country   TEXT NOT NULL DEFAULT 'Brasil';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS type       TEXT NOT NULL DEFAULT 'CLUB';
-- type: CLUB | NATIONAL_TEAM | INTERNATIONAL

-- Seed de seleções nacionais e clubes internacionais populares
INSERT INTO clubs (name, slug, name_search, country, type) VALUES
  -- Seleções
  ('Brasil',      'brasil',      'brasil',       'Brasil',    'NATIONAL_TEAM'),
  ('Argentina',   'argentina',   'argentina',    'Argentina', 'NATIONAL_TEAM'),
  ('Portugal',    'portugal',    'portugal',     'Portugal',  'NATIONAL_TEAM'),
  ('França',      'franca',      'franca',       'França',    'NATIONAL_TEAM'),
  ('Espanha',     'espanha',     'espanha',      'Espanha',   'NATIONAL_TEAM'),
  ('Alemanha',    'alemanha',    'alemanha',     'Alemanha',  'NATIONAL_TEAM'),
  ('Itália',      'italia',      'italia',       'Itália',    'NATIONAL_TEAM'),
  ('Inglaterra',  'inglaterra',  'inglaterra',   'Inglaterra','NATIONAL_TEAM'),

  -- Premier League
  ('Manchester City',   'manchester-city',   'manchester city',   'Inglaterra', 'CLUB'),
  ('Arsenal',           'arsenal',           'arsenal',           'Inglaterra', 'CLUB'),
  ('Liverpool',         'liverpool',         'liverpool',         'Inglaterra', 'CLUB'),
  ('Chelsea',           'chelsea',           'chelsea',           'Inglaterra', 'CLUB'),
  ('Manchester United', 'manchester-united', 'manchester united', 'Inglaterra', 'CLUB'),

  -- La Liga
  ('Real Madrid',       'real-madrid',       'real madrid',       'Espanha',    'CLUB'),
  ('Barcelona',         'barcelona',         'barcelona',         'Espanha',    'CLUB'),
  ('Atlético Madrid',   'atletico-madrid',   'atletico madrid',   'Espanha',    'CLUB'),

  -- Serie A
  ('Juventus',          'juventus',          'juventus',          'Itália',     'CLUB'),
  ('Inter de Milão',    'inter-de-milao',    'inter de milao',    'Itália',     'CLUB'),
  ('AC Milan',          'ac-milan',          'ac milan',          'Itália',     'CLUB'),

  -- Bundesliga
  ('Bayern de Munique', 'bayern-de-munique', 'bayern de munique', 'Alemanha',   'CLUB'),
  ('Borussia Dortmund', 'borussia-dortmund', 'borussia dortmund', 'Alemanha',   'CLUB'),

  -- Ligue 1
  ('PSG',               'psg',               'psg',               'França',     'CLUB')

ON CONFLICT (slug) DO NOTHING;

-- Verificação
-- SELECT name, country, type FROM clubs ORDER BY type, country, name;