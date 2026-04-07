-- K14: Add portfolio columns to project_photos
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS in_portfolio BOOLEAN DEFAULT false;
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS portfolio_category TEXT CHECK (portfolio_category IN (
  'kitchen', 'bathroom', 'addition', 'basement',
  'first_floor', 'before_after', 'detail', 'exterior'
));
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS portfolio_caption TEXT;
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS portfolio_sort_order INTEGER;
ALTER TABLE project_photos ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
