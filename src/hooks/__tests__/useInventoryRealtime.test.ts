import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { mockSupabase } from '../../test/setup';

// Mock react-query
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { useInventoryRealtime } from '../useInventoryRealtime';

let channelStub: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  channelStub = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockResolvedValue('ok'),
    untrack: vi.fn().mockResolvedValue('ok'),
    track: vi.fn().mockResolvedValue('ok'),
    presenceState: vi.fn().mockReturnValue({}),
  };
  mockSupabase.channel.mockReturnValue(channelStub);
  mockSupabase.removeChannel.mockReset();
  mockInvalidateQueries.mockReset();
});

describe('useInventoryRealtime', () => {
  it('creates a channel named inventory-realtime', () => {
    renderHook(() => useInventoryRealtime());
    expect(mockSupabase.channel).toHaveBeenCalledWith('inventory-realtime');
  });

  it('subscribes to all 7 inventory tables', () => {
    renderHook(() => useInventoryRealtime());
    // TABLE_TO_QUERY_KEYS has 7 entries
    expect(channelStub.on).toHaveBeenCalledTimes(7);
  });

  it('subscribes to the correct inventory table names', () => {
    renderHook(() => useInventoryRealtime());
    const tables = channelStub.on.mock.calls.map(
      (c: unknown[]) => (c[1] as Record<string, string>).table,
    );
    expect(tables).toContain('inventory_locations');
    expect(tables).toContain('inventory_categories');
    expect(tables).toContain('inventory_items');
    expect(tables).toContain('inventory_stock');
    expect(tables).toContain('inventory_stocktakes');
    expect(tables).toContain('inventory_item_templates');
    expect(tables).toContain('inventory_alerts');
  });

  it('calls subscribe after registering listeners', () => {
    renderHook(() => useInventoryRealtime());
    expect(channelStub.subscribe).toHaveBeenCalledTimes(1);
  });

  it('invalidates queries when a callback fires', () => {
    renderHook(() => useInventoryRealtime());
    const firstCallback = channelStub.on.mock.calls[0][2] as () => void;
    firstCallback();
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() => useInventoryRealtime());
    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channelStub);
  });

  it('inventory_items callback invalidates inventory_location_items', () => {
    renderHook(() => useInventoryRealtime());
    const itemsCall = channelStub.on.mock.calls.find(
      (c: unknown[]) => (c[1] as Record<string, string>).table === 'inventory_items',
    );
    expect(itemsCall).toBeDefined();
    const callback = itemsCall![2] as () => void;
    callback();
    // Should invalidate both inventory_items AND inventory_location_items
    const keys = mockInvalidateQueries.mock.calls.map(
      (c: unknown[]) => (c[0] as Record<string, unknown>).queryKey,
    );
    const flatKeys = keys.map((k: unknown) => (k as string[])[0]);
    expect(flatKeys).toContain('inventory_items');
    expect(flatKeys).toContain('inventory_location_items');
  });
});
