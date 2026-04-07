-- J4: Seed estimate_templates with Summit County market data
-- All 2025 Summit County, Ohio market rates per spec.

-- KITCHEN — MID-RANGE
INSERT INTO estimate_templates (
  project_type, name, finish_level,
  size_range_min_sqft, size_range_max_sqft,
  total_cost_min, total_cost_max, total_cost_typical,
  duration_weeks_min, duration_weeks_max, duration_weeks_typical,
  unit_costs, trade_breakdown
) VALUES (
  'kitchen', 'Kitchen Remodel — Mid-Range', 'mid_range',
  100, 250,
  35000, 75000, 52000,
  4, 8, 6,
  '{
    "cabinet_linear_ft": {"min": 450, "max": 750, "typical": 575, "unit": "per linear ft"},
    "countertop_sqft": {"min": 50, "max": 120, "typical": 75, "unit": "per sqft"},
    "backsplash_sqft": {"min": 15, "max": 35, "typical": 22, "unit": "per sqft installed"},
    "flooring_sqft": {"min": 8, "max": 20, "typical": 13, "unit": "per sqft installed"},
    "appliance_allowance": {"min": 4000, "max": 12000, "typical": 7000, "unit": "allowance"},
    "plumbing": {"min": 3500, "max": 7000, "typical": 5000, "unit": "rough and finish"},
    "electrical": {"min": 2500, "max": 5500, "typical": 3800, "unit": "rough and finish"},
    "demo_disposal": {"min": 1200, "max": 2800, "typical": 1800, "unit": "flat"},
    "painting": {"min": 800, "max": 2000, "typical": 1200, "unit": "flat"}
  }'::jsonb,
  '{
    "cabinets_hardware": {"pct_typical": 0.32},
    "countertops": {"pct_typical": 0.12},
    "flooring_tile": {"pct_typical": 0.08},
    "plumbing": {"pct_typical": 0.10},
    "electrical": {"pct_typical": 0.07},
    "appliances": {"pct_typical": 0.13},
    "demo_drywall_paint": {"pct_typical": 0.07},
    "crew_labor_pm": {"pct_typical": 0.11}
  }'::jsonb
);

-- KITCHEN — HIGH-END
INSERT INTO estimate_templates (
  project_type, name, finish_level,
  size_range_min_sqft, size_range_max_sqft,
  total_cost_min, total_cost_max, total_cost_typical,
  duration_weeks_min, duration_weeks_max, duration_weeks_typical,
  unit_costs, trade_breakdown
) VALUES (
  'kitchen', 'Kitchen Remodel — High-End', 'high_end',
  150, 400,
  75000, 180000, 115000,
  6, 14, 10,
  '{
    "cabinet_linear_ft": {"min": 800, "max": 2500, "typical": 1400, "unit": "per linear ft"},
    "countertop_sqft": {"min": 100, "max": 350, "typical": 180, "unit": "per sqft"},
    "backsplash_sqft": {"min": 30, "max": 120, "typical": 60, "unit": "per sqft installed"},
    "flooring_sqft": {"min": 15, "max": 45, "typical": 28, "unit": "per sqft installed"},
    "appliance_allowance": {"min": 15000, "max": 60000, "typical": 30000, "unit": "allowance"},
    "plumbing": {"min": 6000, "max": 15000, "typical": 9000, "unit": "rough and finish"},
    "electrical": {"min": 5000, "max": 14000, "typical": 8500, "unit": "rough and finish"},
    "demo_disposal": {"min": 2000, "max": 5000, "typical": 3200, "unit": "flat"},
    "painting": {"min": 1500, "max": 5000, "typical": 2800, "unit": "flat"}
  }'::jsonb,
  '{
    "cabinets_hardware": {"pct_typical": 0.35},
    "countertops": {"pct_typical": 0.14},
    "flooring_tile": {"pct_typical": 0.07},
    "plumbing": {"pct_typical": 0.08},
    "electrical": {"pct_typical": 0.07},
    "appliances": {"pct_typical": 0.18},
    "demo_drywall_paint": {"pct_typical": 0.05},
    "crew_labor_pm": {"pct_typical": 0.06}
  }'::jsonb
);

-- BATHROOM — MID-RANGE
INSERT INTO estimate_templates (
  project_type, name, finish_level,
  size_range_min_sqft, size_range_max_sqft,
  total_cost_min, total_cost_max, total_cost_typical,
  duration_weeks_min, duration_weeks_max, duration_weeks_typical,
  unit_costs, trade_breakdown
) VALUES (
  'bathroom', 'Bathroom Remodel — Mid-Range', 'mid_range',
  35, 100,
  18000, 45000, 28000,
  2, 5, 3,
  '{
    "vanity_each": {"min": 800, "max": 3500, "typical": 1800, "unit": "each installed"},
    "shower_tile_sqft": {"min": 18, "max": 40, "typical": 26, "unit": "per sqft installed"},
    "floor_tile_sqft": {"min": 12, "max": 28, "typical": 18, "unit": "per sqft installed"},
    "shower_door_each": {"min": 600, "max": 2500, "typical": 1200, "unit": "each"},
    "tub_each": {"min": 500, "max": 4000, "typical": 1500, "unit": "each installed"},
    "fixtures_allowance": {"min": 800, "max": 3500, "typical": 1800, "unit": "allowance"},
    "plumbing": {"min": 3000, "max": 7000, "typical": 4800, "unit": "rough and finish"},
    "electrical": {"min": 1200, "max": 3000, "typical": 1800, "unit": "rough and finish"},
    "demo_disposal": {"min": 800, "max": 2000, "typical": 1200, "unit": "flat"}
  }'::jsonb,
  '{
    "tile_materials_install": {"pct_typical": 0.28},
    "plumbing": {"pct_typical": 0.18},
    "vanity_fixtures": {"pct_typical": 0.16},
    "electrical": {"pct_typical": 0.07},
    "shower_door_tub": {"pct_typical": 0.08},
    "demo_drywall_paint": {"pct_typical": 0.10},
    "crew_labor_pm": {"pct_typical": 0.13}
  }'::jsonb
);

-- ADDITION — STANDARD
INSERT INTO estimate_templates (
  project_type, name, finish_level,
  size_range_min_sqft, size_range_max_sqft,
  total_cost_min, total_cost_max, total_cost_typical,
  duration_weeks_min, duration_weeks_max, duration_weeks_typical,
  unit_costs, trade_breakdown
) VALUES (
  'addition', 'Home Addition — Standard', 'mid_range',
  200, 800,
  150000, 450000, 280000,
  16, 36, 24,
  '{
    "cost_per_sqft": {"min": 200, "max": 380, "typical": 280, "unit": "per sqft finished"},
    "foundation_linear_ft": {"min": 180, "max": 380, "typical": 260, "unit": "per linear ft"},
    "framing_sqft": {"min": 28, "max": 55, "typical": 38, "unit": "per sqft"},
    "roofing_sqft": {"min": 8, "max": 18, "typical": 13, "unit": "per sqft"},
    "windows_each": {"min": 450, "max": 1800, "typical": 900, "unit": "each installed"},
    "exterior_door_each": {"min": 800, "max": 3500, "typical": 1600, "unit": "each installed"},
    "hvac_per_ton": {"min": 3500, "max": 7000, "typical": 5000, "unit": "per ton capacity"},
    "electrical_sqft": {"min": 18, "max": 38, "typical": 26, "unit": "per sqft"},
    "plumbing_fixture": {"min": 800, "max": 2500, "typical": 1400, "unit": "per fixture"}
  }'::jsonb,
  '{
    "excavation_foundation": {"pct_typical": 0.12},
    "framing": {"pct_typical": 0.14},
    "exterior_envelope": {"pct_typical": 0.16},
    "mechanical_electrical_plumbing": {"pct_typical": 0.20},
    "interior_finishes": {"pct_typical": 0.22},
    "crew_labor_pm": {"pct_typical": 0.10},
    "contingency": {"pct_typical": 0.06}
  }'::jsonb
);

-- BASEMENT FINISH
INSERT INTO estimate_templates (
  project_type, name, finish_level,
  size_range_min_sqft, size_range_max_sqft,
  total_cost_min, total_cost_max, total_cost_typical,
  duration_weeks_min, duration_weeks_max, duration_weeks_typical,
  unit_costs, trade_breakdown
) VALUES (
  'basement', 'Basement Finish — Standard', 'mid_range',
  400, 1200,
  35000, 95000, 58000,
  5, 10, 7,
  '{
    "cost_per_sqft": {"min": 50, "max": 100, "typical": 68, "unit": "per sqft finished"},
    "framing_sqft": {"min": 4, "max": 10, "typical": 6.50, "unit": "per sqft"},
    "electrical_sqft": {"min": 8, "max": 18, "typical": 12, "unit": "per sqft"},
    "drywall_sqft": {"min": 2.50, "max": 5, "typical": 3.50, "unit": "per sqft"},
    "flooring_sqft": {"min": 4, "max": 18, "typical": 9, "unit": "per sqft installed"},
    "bathroom_rough_in": {"min": 4000, "max": 12000, "typical": 7500, "unit": "if adding bath"},
    "egress_window_each": {"min": 2500, "max": 5500, "typical": 3800, "unit": "each"}
  }'::jsonb,
  '{
    "framing_insulation": {"pct_typical": 0.10},
    "electrical": {"pct_typical": 0.14},
    "drywall_paint": {"pct_typical": 0.16},
    "flooring": {"pct_typical": 0.14},
    "bathroom_if_applicable": {"pct_typical": 0.18},
    "trim_doors": {"pct_typical": 0.10},
    "crew_labor_pm": {"pct_typical": 0.18}
  }'::jsonb
);

-- FIRST-FLOOR TRANSFORMATION
INSERT INTO estimate_templates (
  project_type, name, finish_level,
  size_range_min_sqft, size_range_max_sqft,
  total_cost_min, total_cost_max, total_cost_typical,
  duration_weeks_min, duration_weeks_max, duration_weeks_typical,
  unit_costs, trade_breakdown
) VALUES (
  'first_floor', 'First-Floor Transformation', 'mid_range',
  800, 2000,
  65000, 180000, 110000,
  8, 18, 12,
  '{
    "cost_per_sqft": {"min": 65, "max": 130, "typical": 90, "unit": "per sqft affected"},
    "wall_removal_each": {"min": 2500, "max": 8000, "typical": 4500, "unit": "per bearing wall"},
    "flooring_sqft": {"min": 6, "max": 22, "typical": 12, "unit": "per sqft installed"},
    "trim_linear_ft": {"min": 6, "max": 16, "typical": 10, "unit": "per linear ft"},
    "painting_sqft": {"min": 1.50, "max": 4, "typical": 2.50, "unit": "per sqft wall area"},
    "electrical_updates": {"min": 4000, "max": 14000, "typical": 7500, "unit": "allowance"},
    "kitchen_if_included": {"min": 35000, "max": 120000, "typical": 55000, "unit": "if in scope"}
  }'::jsonb,
  '{
    "structural_demo": {"pct_typical": 0.08},
    "flooring": {"pct_typical": 0.16},
    "kitchen_if_applicable": {"pct_typical": 0.30},
    "electrical": {"pct_typical": 0.08},
    "drywall_paint": {"pct_typical": 0.14},
    "trim_doors": {"pct_typical": 0.10},
    "crew_labor_pm": {"pct_typical": 0.14}
  }'::jsonb
);
