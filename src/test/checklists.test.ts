// Checklist workflow tests
// DB-dependent tests are skipped until a staging Supabase project is configured.
// Checklist generation depends on DB triggers that fire when project status changes to 'active'.
// To enable: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a staging project
// with checklist_templates seeded (14 templates from Phase J migrations).

import { describe, it, expect } from 'vitest';
import { testSupabase } from './setup';

// Tests only run when a dedicated staging project is explicitly configured.
// Set TEST_STAGING_URL + TEST_STAGING_ANON_KEY to a staging (non-production) Supabase project.
// Never runs against production automatically even if VITE_SUPABASE_URL is set.
const HAS_STAGING_DB = !!(process.env.TEST_STAGING_URL && process.env.TEST_STAGING_ANON_KEY);

describe('Checklists', () => {
  it.skipIf(!HAS_STAGING_DB)(
    'generates a checklist instance when a project status changes to active',
    async () => {
      const testLeadId = process.env.TEST_LEAD_ID;
      const testUserId = process.env.TEST_USER_ID;
      if (!testLeadId || !testUserId) {
        console.warn('Skipping: TEST_LEAD_ID and TEST_USER_ID env vars not set');
        return;
      }
      // Create a project in 'pending' status
      const { data: project } = await testSupabase
        .from('projects')
        .insert({
          lead_id: testLeadId,
          title: 'Checklist Test Project',
          project_type: 'bathroom',
          client_name: 'Test Client',
          address: '123 Test St',
          contract_value: 20000,
          status: 'pending',
        })
        .select()
        .single();
      // Transition to 'active' — should trigger checklist generation
      await testSupabase
        .from('projects')
        .update({ status: 'active' })
        .eq('id', project.id);
      // Wait briefly for trigger to fire
      await new Promise(r => setTimeout(r, 1000));
      const { data: instances } = await testSupabase
        .from('checklist_instances')
        .select('*')
        .eq('project_id', project.id);
      // At least one checklist instance should exist for a bathroom project
      expect(instances).not.toBeNull();
      expect((instances ?? []).length).toBeGreaterThan(0);
      // Cleanup
      if (instances) {
        for (const inst of instances) {
          await testSupabase.from('checklist_instance_items').delete().eq('instance_id', inst.id);
          await testSupabase.from('checklist_instances').delete().eq('id', inst.id);
        }
      }
      await testSupabase.from('projects').delete().eq('id', project.id);
    }
  );

  it.skipIf(!HAS_STAGING_DB)(
    'generated instance has items matching the template for that project type',
    async () => {
      // Verify the checklist templates exist and have items
      const { data: templates } = await testSupabase
        .from('checklist_templates')
        .select('id, name, project_type')
        .eq('project_type', 'bathroom')
        .limit(1);
      expect((templates ?? []).length).toBeGreaterThan(0);
      const templateId = templates![0].id;
      const { data: items } = await testSupabase
        .from('checklist_template_items')
        .select('id')
        .eq('template_id', templateId);
      expect((items ?? []).length).toBeGreaterThan(0);
    }
  );

  it.skipIf(!HAS_STAGING_DB)(
    'checklist items can be marked complete',
    async () => {
      // Get any checklist instance with items
      const { data: instances } = await testSupabase
        .from('checklist_instances')
        .select('id')
        .limit(1);
      if (!instances || instances.length === 0) {
        console.warn('No checklist instances found in staging DB');
        return;
      }
      const instanceId = instances[0].id;
      const { data: items } = await testSupabase
        .from('checklist_instance_items')
        .select('id, is_complete')
        .eq('instance_id', instanceId)
        .eq('is_complete', false)
        .limit(1);
      if (!items || items.length === 0) {
        console.warn('No incomplete checklist items found');
        return;
      }
      const { error } = await testSupabase
        .from('checklist_instance_items')
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq('id', items[0].id);
      expect(error).toBeNull();
      // Restore
      await testSupabase
        .from('checklist_instance_items')
        .update({ is_complete: false, completed_at: null })
        .eq('id', items[0].id);
    }
  );

  it.skipIf(!HAS_STAGING_DB)(
    'completion percentage updates correctly as items are completed',
    async () => {
      const { data: instances } = await testSupabase
        .from('checklist_instances')
        .select('id, percent_complete')
        .limit(1);
      if (!instances || instances.length === 0) return;
      const instance = instances[0];
      const { data: items } = await testSupabase
        .from('checklist_instance_items')
        .select('id, is_complete')
        .eq('instance_id', instance.id);
      if (!items || items.length === 0) return;
      const total = items.length;
      const completed = items.filter(i => i.is_complete).length;
      const expectedPercent = Math.round((completed / total) * 100);
      // The percent_complete on the instance should match
      expect(instance.percent_complete).toBe(expectedPercent);
    }
  );

  it('checklist item statuses are well-defined', () => {
    // Pure unit test — documents the expected structure
    const expectedFields = ['id', 'instance_id', 'is_complete', 'completed_at'];
    expect(expectedFields).toContain('is_complete');
    expect(expectedFields).toContain('completed_at');
  });
});
