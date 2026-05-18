-- Migration 011: renomear tamanhos para G, GG, GGG, GGGG

-- 1. Adicionar novos valores
ALTER TYPE shirt_size ADD VALUE IF NOT EXISTS 'GGG';
ALTER TYPE shirt_size ADD VALUE IF NOT EXISTS 'GGGG';

-- 2. Atualizar dados existentes
UPDATE products SET stock_categorical = array_replace(stock_categorical, '2GG', 'GGG') WHERE '2GG' = ANY(stock_categorical);
UPDATE products SET stock_categorical = array_replace(stock_categorical, '3GG', 'GGGG') WHERE '3GG' = ANY(stock_categorical);
UPDATE products SET stock_categorical = array_replace(stock_categorical, '4GG', 'GGGG') WHERE '4GG' = ANY(stock_categorical);

-- 3. Remover valores antigos (opcional - precisa garantir que não estão em uso)
-- ALTER TYPE shirt_size DROP VALUE '2GG';
-- ALTER TYPE shirt_size DROP VALUE '3GG';
-- ALTER TYPE shirt_size DROP VALUE '4GG';