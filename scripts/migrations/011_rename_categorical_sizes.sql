-- ==========================================================
-- Migration 011: Adicionar novos tamanhos GGG e GGGG
-- ==========================================================

-- Adicionar novos valores (sem tentar remover os antigos)
ALTER TYPE shirt_size ADD VALUE IF NOT EXISTS 'GGG';
ALTER TYPE shirt_size ADD VALUE IF NOT EXISTS 'GGGG';

-- Atualizar produtos (mapear valores antigos para novos)
UPDATE products SET stock_categorical = array_replace(stock_categorical, '2GG', 'GGG') WHERE '2GG' = ANY(stock_categorical);
UPDATE products SET stock_categorical = array_replace(stock_categorical, '3GG', 'GGGG') WHERE '3GG' = ANY(stock_categorical);
UPDATE products SET stock_categorical = array_replace(stock_categorical, '4GG', 'GGGG') WHERE '4GG' = ANY(stock_categorical);