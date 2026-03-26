-- Fix duplicate categories and add unique constraint

-- First, remove duplicate categories, keeping only the first occurrence
DELETE FROM categories ct1 USING categories ct2 
WHERE ct1.id > ct2.id 
AND ct1.name = ct2.name 
AND ct1.type = ct2.type;

-- Add unique constraint to prevent future duplicates
ALTER TABLE categories ADD CONSTRAINT unique_category_name_type UNIQUE (name, type);
