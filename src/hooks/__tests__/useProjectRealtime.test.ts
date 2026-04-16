import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { mockSupabase } from '../../test/setup';

// Mock react-query
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { useProjectRealtime } from '../useProjectRealtime';

// Capture the channel stub returned by supabase.channel()
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

describe('useProjectRealtime', () => {
  it('no-ops when projectId is falsy', () => {
    renderHook(() => useProjectRealtime(null));
    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });

  it('no-ops when projectId is undefined', () => {
    renderHook(() => useProjectRealtime(undefined));
    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });

  it('no-ops when projectId is empty string', () => {
    renderHook(() => useProjectRealtime(''));
    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });

  it('creates a channel named project:<id>', () => {
    renderHook(() => useProjectRealtime('abc-123'));
    expect(mockSupabase.channel).toHaveBeenCalledWith('project:abc-123');
  });

  it('registers listeners for all 14 project tables', () => {
    renderHook(() => useProjectRealtime('proj-1'));
    // TABLE_TO_QUERY_KEYS has 14 entries
    expect(channelStub.on).toHaveBeenCalledTimes(14);
  });

  it('calls subscribe after registering listeners', () => {
    renderHook(() => useProjectRealtime('proj-1'));
    expect(channelStub.subscribe).toHaveBeenCalledTimes(1);
  });

  it('each listener uses postgres_changes with correct table filter', () => {
    renderHook(() => useProjectRealtime('proj-1'));
    const calls = channelStub.on.mock.calls;

    // Find the call for 'projects' table — it should filter by id, not project_id
    const projectsCall = calls.find(
      (c: unknown[]) => (c[1] as Record<string, string>).table === 'projects',
    );
    expect(projectsCall).toBeDefined();
    expect((projectsCall![1] as Record<string, string>).filter).toBe('id=eq.proj-1');

    // All other tables should filter by project_id
    const taskCall = calls.find(
      (c: unknown[]) => (c[1] as Record<string, string>).table === 'tasks',
    );
    expect(taskCall).toBeDefined();
    expect((taskCall![1] as Record<string, string>).filter).toBe('project_id=eq.proj-1');
  });

  it('invalidates queries when a callback fires', () => {
    renderHook(() => useProjectRealtime('proj-1'));
    // Grab the callback for the first .on() call and fire it
    const firstCallback = channelStub.on.mock.calls[0][2] as () => void;
    firstCallback();
    // Should have called invalidateQueries at least once
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() => useProjectRealtime('proj-1'));
    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channelStub);
  });
});
