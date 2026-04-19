import { describe, it, expect } from 'vitest';
import {
  COMMANDS,
  getVisibleCommands,
  findCommand,
  searchCommands,
  type CommandContext,
  type CommandRole,
} from '../commands';
import type { AppUser } from '@/context/AuthContext';

function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    pathname: '/admin/dashboard',
    user: {
      id: 'u1',
      email: 'admin@test.com',
      role: 'admin' as const,
      full_name: 'Test Admin',
      avatar_url: null,
      company_id: 'c1',
      platform_onboarding_complete: true,
      company_onboarding_complete: true,
      field_onboarding_complete: true,
    },
    params: {},
    ...overrides,
  };
}

function makeUser(role: CommandRole): AppUser {
  return {
    id: 'u1',
    email: `${role}@test.com`,
    role,
    full_name: `Test ${role}`,
    avatar_url: null,
    company_id: 'c1',
    platform_onboarding_complete: true,
    company_onboarding_complete: true,
    field_onboarding_complete: true,
  };
}

describe('Command registry', () => {
  it('every command has all required fields', () => {
    for (const cmd of COMMANDS) {
      expect(cmd.id).toBeTruthy();
      expect(typeof cmd.label).toBe('string');
      expect(typeof cmd.icon).toBe('string');
      expect(typeof cmd.description).toBe('string');
      expect(Array.isArray(cmd.roles)).toBe(true);
      expect(cmd.roles.length).toBeGreaterThan(0);
      expect(typeof cmd.when).toBe('function');
      expect(typeof cmd.execute).toBe('function');
    }
  });

  it('has no duplicate command IDs', () => {
    const ids = COMMANDS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all roles are valid', () => {
    const validRoles: CommandRole[] = ['platform_owner', 'admin', 'employee', 'client'];
    for (const cmd of COMMANDS) {
      for (const role of cmd.roles) {
        expect(validRoles).toContain(role);
      }
    }
  });
});

describe('when() predicates', () => {
  it('clock_in is only visible to employees', () => {
    const cmd = findCommand('clock_in')!;
    expect(cmd.when(makeCtx({ user: makeUser('employee') }))).toBe(true);
    expect(cmd.when(makeCtx({ user: makeUser('admin') }))).toBe(false);
  });

  it('add_task shows only when on a project page', () => {
    const cmd = findCommand('add_task')!;
    expect(cmd.when(makeCtx({ pathname: '/admin/projects/abc-123/tasks' }))).toBe(true);
    expect(cmd.when(makeCtx({ pathname: '/admin/dashboard' }))).toBe(false);
    expect(cmd.when(makeCtx({ pathname: '/employee/projects/xyz-456' }))).toBe(true);
  });

  it('log_daily is only visible to employees', () => {
    // Registry uses `log_daily` (voiceIntents maps here too); there is no
    // `daily_log` command — renaming this assertion instead of touching the
    // registry keeps voice + test + app in sync.
    const cmd = findCommand('log_daily')!;
    expect(cmd.when(makeCtx({ user: makeUser('employee') }))).toBe(true);
    expect(cmd.when(makeCtx({ user: makeUser('admin') }))).toBe(false);
  });

  it('ask_about_project is only visible to clients', () => {
    const cmd = findCommand('ask_about_project')!;
    expect(cmd.when(makeCtx({ user: makeUser('client') }))).toBe(true);
    expect(cmd.when(makeCtx({ user: makeUser('admin') }))).toBe(false);
  });

  it('create_project when() always returns true', () => {
    const cmd = findCommand('create_project')!;
    expect(cmd.when(makeCtx())).toBe(true);
  });
});

describe('getVisibleCommands', () => {
  it('returns no commands when user is null', () => {
    expect(getVisibleCommands(makeCtx({ user: null }))).toHaveLength(0);
  });

  it('returns admin-visible commands for admin users', () => {
    const cmds = getVisibleCommands(makeCtx({ user: makeUser('admin') }));
    expect(cmds.length).toBeGreaterThan(0);
    // clock_in should NOT be in the list (employee only + when() returns false)
    expect(cmds.find((c) => c.id === 'clock_in')).toBeUndefined();
    // create_project SHOULD be in the list
    expect(cmds.find((c) => c.id === 'create_project')).toBeDefined();
  });

  it('returns employee-visible commands for employees', () => {
    const cmds = getVisibleCommands(
      makeCtx({ user: makeUser('employee'), pathname: '/employee/dashboard' }),
    );
    expect(cmds.find((c) => c.id === 'clock_in')).toBeDefined();
    // create_project should NOT appear (admin only)
    expect(cmds.find((c) => c.id === 'create_project')).toBeUndefined();
  });
});

describe('findCommand', () => {
  it('returns a command by exact ID', () => {
    const cmd = findCommand('create_project');
    expect(cmd).toBeDefined();
    expect(cmd!.id).toBe('create_project');
  });

  it('returns undefined for nonexistent ID', () => {
    expect(findCommand('nonexistent')).toBeUndefined();
  });
});

describe('searchCommands', () => {
  it('finds commands by label substring', () => {
    const results = searchCommands('clock', makeCtx({ user: makeUser('employee') }));
    expect(results.some((c) => c.id === 'clock_in')).toBe(true);
  });

  it('finds commands by description substring', () => {
    const results = searchCommands('shift', makeCtx({ user: makeUser('employee') }));
    expect(results.some((c) => c.id === 'clock_in')).toBe(true);
  });

  it('search is case-insensitive', () => {
    const results = searchCommands('CLOCK', makeCtx({ user: makeUser('employee') }));
    expect(results.some((c) => c.id === 'clock_in')).toBe(true);
  });

  it('returns empty for no match', () => {
    const results = searchCommands('xyznonexistent', makeCtx({ user: makeUser('admin') }));
    expect(results).toHaveLength(0);
  });
});

describe('execute', () => {
  // All commands have been promoted past the "stub / coming soon" phase —
  // they either navigate via the agent:navigate event or call a real Supabase
  // function. The old test that asserted a coming-soon stub on
  // `generate_invoice` is obsolete: generate_invoice is now a real navigation
  // to /admin/invoices?action=new.
  it('generate_invoice navigates instead of returning a stub', async () => {
    const cmd = findCommand('generate_invoice')!;
    const result = await cmd.execute({}, makeCtx());
    expect(result.ok).toBe(true);
    expect(result.message).toBe('__navigate__');
    expect((result.data as { path: string }).path).toBe('/admin/invoices?action=new');
  });
});
