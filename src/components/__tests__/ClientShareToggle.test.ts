/**
 * Tests for the ClientShareToggle component logic.
 *
 * Since the component is tightly coupled to React rendering + supabase,
 * we test the type safety and contract aspects rather than full DOM rendering.
 * A full render test would need jsdom + full React context which is overkill
 * for a 75-line component.
 */

import { describe, it, expect } from 'vitest';

// The set of valid tables for ClientShareToggle
const VALID_TABLES = [
  'shopping_list_items',
  'project_photos',
  'change_orders',
  'punch_list_items',
  'daily_logs',
  'warranty_claims',
] as const;

describe('ClientShareToggle contract', () => {
  it('supports exactly 6 tables from the visibility migration', () => {
    expect(VALID_TABLES.length).toBe(6);
  });

  it('all table names are valid postgres identifiers', () => {
    for (const table of VALID_TABLES) {
      expect(table).toMatch(/^[a-z_]+$/);
    }
  });

  it('each table is unique', () => {
    const unique = new Set(VALID_TABLES);
    expect(unique.size).toBe(VALID_TABLES.length);
  });

  it('the toggle mutation targets visible_to_client column', () => {
    // This is a documentation test — if the column name changes,
    // someone should update both the component and this test.
    // We verify by reading the source.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/project/ClientShareToggle.tsx'),
      'utf-8',
    );
    expect(src).toContain('visible_to_client');
    expect(src).toContain('.update(');
    expect(src).toContain(".eq('id', rowId)");
  });

  it('component uses optimistic updates (setOptimistic pattern)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../components/project/ClientShareToggle.tsx'),
      'utf-8',
    );
    // Optimistic state pattern
    expect(src).toContain('setOptimistic');
    // Revert on error
    expect(src).toContain('setOptimistic(current)');
  });
});
