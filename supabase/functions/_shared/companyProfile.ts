import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface CompanyProfile {
  id: string;
  name: string;
  industry: string;
  location: string;
  owner_name: string;
  description: string;
}

// Default fallback if company lookup fails (backward compat with existing AK Renovations setup)
const DEFAULT_PROFILE: CompanyProfile = {
  id: 'default',
  name: 'the company',
  industry: 'contracting',
  location: 'the local area',
  owner_name: 'the owner',
  description: 'a professional contractor',
};

/**
 * Fetch the company profile for system prompt injection.
 * Tries to resolve from the authenticated user's profile → company.
 * Falls back to DEFAULT_PROFILE if anything fails.
 */
export async function getCompanyProfile(
  supabase: SupabaseClient,
  userId?: string
): Promise<CompanyProfile> {
  try {
    if (!userId) return DEFAULT_PROFILE;

    // Get user's company_id from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (!profile?.company_id) return DEFAULT_PROFILE;

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, industry, city, state, owner_name, description')
      .eq('id', profile.company_id)
      .single();

    if (!company) return DEFAULT_PROFILE;

    return {
      id: company.id,
      name: company.name || DEFAULT_PROFILE.name,
      industry: company.industry || DEFAULT_PROFILE.industry,
      location: [company.city, company.state].filter(Boolean).join(', ') || DEFAULT_PROFILE.location,
      owner_name: company.owner_name || DEFAULT_PROFILE.owner_name,
      description: company.description || `a professional ${company.industry || 'contracting'} company`,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Build the base system prompt for any agent.
 * Replaces all hardcoded "AK Renovations" references.
 */
export function buildSystemPrompt(company: CompanyProfile, agentRole: string): string {
  return `You are an AI ${agentRole} for ${company.name}, ${company.description} in ${company.location}.${company.owner_name ? ' ' + company.owner_name + ' is the owner.' : ''}`;
}
