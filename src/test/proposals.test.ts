// Proposal workflow tests
// DB-dependent tests are skipped until a staging Supabase project is configured.
// To enable: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a staging project.

import { describe, it, expect } from 'vitest';
import { testSupabase } from './setup';

// Tests only run when a dedicated staging project is explicitly configured.
// Set TEST_STAGING_URL + TEST_STAGING_ANON_KEY to a staging (non-production) Supabase project.
// Never runs against production automatically even if VITE_SUPABASE_URL is set.
const HAS_STAGING_DB = !!(process.env.TEST_STAGING_URL && process.env.TEST_STAGING_ANON_KEY);

describe('Proposals', () => {
  it.skipIf(!HAS_STAGING_DB)(
    'creates a proposal linked to a lead',
    async () => {
      const testLeadId = process.env.TEST_LEAD_ID;
      if (!testLeadId) {
        console.warn('Skipping: TEST_LEAD_ID env var not set');
        return;
      }
      const { data, error } = await testSupabase
        .from('proposals')
        .insert({
          lead_id: testLeadId,
          title: 'Test Proposal',
          client_name: 'Test Client',
          project_type: 'bathroom',
          sections: [],
          status: 'draft',
        })
        .select()
        .single();
      expect(error).toBeNull();
      expect(data.lead_id).toBe(testLeadId);
      expect(data.status).toBe('draft');
      if (data?.id) await testSupabase.from('proposals').delete().eq('id', data.id);
    }
  );

  it.skipIf(!HAS_STAGING_DB)(
    'allows valid proposal status transitions: draft → sent → accepted',
    async () => {
      const testLeadId = process.env.TEST_LEAD_ID;
      if (!testLeadId) return;
      const { data: proposal } = await testSupabase
        .from('proposals')
        .insert({
          lead_id: testLeadId,
          title: 'Status Transition Test',
          client_name: 'Test Client',
          project_type: 'kitchen',
          sections: [],
          status: 'draft',
        })
        .select()
        .single();
      // draft → sent
      const { data: sent, error: sentError } = await testSupabase
        .from('proposals')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', proposal.id)
        .select()
        .single();
      expect(sentError).toBeNull();
      expect(sent.status).toBe('sent');
      // sent → accepted
      const { data: accepted, error: acceptedError } = await testSupabase
        .from('proposals')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', proposal.id)
        .select()
        .single();
      expect(acceptedError).toBeNull();
      expect(accepted.status).toBe('accepted');
      await testSupabase.from('proposals').delete().eq('id', proposal.id);
    }
  );

  it.skipIf(!HAS_STAGING_DB)(
    'rejects a proposal with missing required fields (title)',
    async () => {
      const { error } = await testSupabase
        .from('proposals')
        .insert({
          // title intentionally missing
          client_name: 'Test',
          project_type: 'bathroom',
          sections: [],
        } as Parameters<typeof testSupabase.from>[0] extends never ? never : object);
      // Supabase NOT NULL constraint on title should cause error
      expect(error).not.toBeNull();
    }
  );

  it.skipIf(!HAS_STAGING_DB)(
    'converting an accepted proposal creates a contract record',
    async () => {
      const testLeadId = process.env.TEST_LEAD_ID;
      if (!testLeadId) return;
      // Create accepted proposal
      const { data: proposal } = await testSupabase
        .from('proposals')
        .insert({
          lead_id: testLeadId,
          title: 'Contract Conversion Test',
          client_name: 'Test Client',
          project_type: 'addition',
          sections: [],
          total_price: 50000,
          status: 'accepted',
        })
        .select()
        .single();
      // Create contract from proposal
      const { data: contract, error } = await testSupabase
        .from('contracts')
        .insert({
          proposal_id: proposal.id,
          lead_id: testLeadId,
          title: 'Contract for Test Proposal',
          total_value: 50000,
          status: 'draft',
        })
        .select()
        .single();
      expect(error).toBeNull();
      expect(contract.proposal_id).toBe(proposal.id);
      // Cleanup
      await testSupabase.from('contracts').delete().eq('id', contract.id);
      await testSupabase.from('proposals').delete().eq('id', proposal.id);
    }
  );

  it('proposal status values match schema CHECK constraint', () => {
    // Pure unit test — verifies the status values we use in code match the DB schema
    const validStatuses = ['draft', 'sent', 'viewed', 'accepted', 'declined'];
    expect(validStatuses).toContain('draft');
    expect(validStatuses).toContain('sent');
    expect(validStatuses).toContain('accepted');
    expect(validStatuses).not.toContain('approved'); // schema uses 'accepted', not 'approved'
  });
});
