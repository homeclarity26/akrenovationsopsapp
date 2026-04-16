import { describe, it, expect, vi } from 'vitest';
import { searchEntityCache, type EntityHit } from '../entityIndex';

// Minimal QueryClient stub that supports getQueriesData
function makeQueryClient(data: Record<string, unknown[]>) {
  return {
    getQueriesData: vi.fn(({ queryKey }: { queryKey: string[] }) => {
      const prefix = queryKey[0];
      const entries = data[prefix];
      if (!entries) return [];
      // Return format: [[queryKey, data]]
      return [[[prefix], entries]];
    }),
  };
}

describe('searchEntityCache', () => {
  const projects = [
    { id: 'p1', name: 'Smith Kitchen Remodel', status: 'active', address: '123 Main St' },
    { id: 'p2', name: 'Johnson Bathroom', status: 'planning', address: '456 Oak Ave' },
    { id: 'p3', name: 'Davis Basement Finish', status: 'complete' },
  ];

  const contacts = [
    { id: 'c1', full_name: 'John Smith', email: 'john@smith.com', company: 'Smith Corp' },
    { id: 'c2', name: 'Jane Doe', email: 'jane@doe.com' },
  ];

  const inventoryItems = [
    { id: 'i1', name: 'Drywall Sheet 4x8', sku: 'DW-48', category_name: 'Materials' },
    { id: 'i2', name: 'Paint - Eggshell White', sku: 'PT-EW', category_name: 'Paint' },
  ];

  function makeClient() {
    return makeQueryClient({
      projects,
      contacts,
      crm_contacts: [],
      inventory_items: inventoryItems,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  it('returns matching projects by name substring', () => {
    const results = searchEntityCache(makeClient(), 'smith');
    expect(results.some((r: EntityHit) => r.id === 'p1')).toBe(true);
    expect(results.some((r: EntityHit) => r.type === 'project')).toBe(true);
  });

  it('search is case-insensitive', () => {
    const results = searchEntityCache(makeClient(), 'JOHNSON');
    expect(results.some((r: EntityHit) => r.id === 'p2')).toBe(true);
  });

  it('matches projects by address', () => {
    const results = searchEntityCache(makeClient(), 'Oak Ave');
    expect(results.some((r: EntityHit) => r.id === 'p2')).toBe(true);
  });

  it('returns contacts matching by name', () => {
    const results = searchEntityCache(makeClient(), 'john');
    const contactHit = results.find((r: EntityHit) => r.type === 'contact');
    expect(contactHit).toBeDefined();
    expect(contactHit!.id).toBe('c1');
  });

  it('returns contacts matching by email', () => {
    const results = searchEntityCache(makeClient(), 'jane@doe');
    expect(results.some((r: EntityHit) => r.type === 'contact')).toBe(true);
  });

  it('returns inventory items matching by name', () => {
    const results = searchEntityCache(makeClient(), 'drywall');
    expect(results.some((r: EntityHit) => r.type === 'item')).toBe(true);
  });

  it('returns inventory items matching by SKU', () => {
    const results = searchEntityCache(makeClient(), 'PT-EW');
    expect(results.some((r: EntityHit) => r.type === 'item')).toBe(true);
  });

  it('returns empty array for no match', () => {
    const results = searchEntityCache(makeClient(), 'xyznonexistent');
    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty query', () => {
    const results = searchEntityCache(makeClient(), '');
    expect(results).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    // Search for something that matches multiple entities
    const results = searchEntityCache(makeClient(), 'smith', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('handles missing cache gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emptyClient = makeQueryClient({}) as any;
    const results = searchEntityCache(emptyClient, 'smith');
    expect(results).toHaveLength(0);
  });
});
