import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/util/supabase/api';
import { getCurrentUserOrganizationId, validateOrganizationAccess } from '@/util/organizationUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(req, res);
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's current organization
    const { data: userData, error: userError } = await supabase
      .from('User')
      .select('organizationId')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.organizationId) {
      return res.status(404).json({ error: 'User organization not found' });
    }

    // Validate organization access
    const hasAccess = await validateOrganizationAccess(userData.organizationId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to organization' });
    }

    // Get organization details with subscription
    const { data: organization, error: orgError } = await supabase
      .from('Organization')
      .select(`
        *,
        subscription:Subscription(*),
        members:OrganizationMember(
          id,
          role,
          inviteAccepted,
          user:User(id, email)
        )
      `)
      .eq('id', userData.organizationId)
      .single();

    if (orgError) {
      return res.status(500).json({ error: 'Failed to fetch organization' });
    }

    // Get user's role in the organization
    const { data: membershipData, error: membershipError } = await supabase
      .from('OrganizationMember')
      .select('role')
      .eq('organizationId', userData.organizationId)
      .eq('userId', user.id)
      .eq('inviteAccepted', true)
      .single();

    if (membershipError) {
      return res.status(500).json({ error: 'Failed to fetch user role' });
    }

    // Return organization data with user's role
    return res.status(200).json({
      organization,
      userRole: membershipData.role,
      userId: user.id
    });

  } catch (error) {
    console.error('Error fetching current organization:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}