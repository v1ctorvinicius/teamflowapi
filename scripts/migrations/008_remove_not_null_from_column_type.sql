-- Migration 008: tornar type opcional (produtos sem tipo)

-- 1. Remover NOT NULL da coluna type
ALTER TABLE products ALTER COLUMN type DROP NOT NULL;