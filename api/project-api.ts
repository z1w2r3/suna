import { createSupabaseClient } from '@/constants/SupabaseConfig';
import { useQuery } from '@tanstack/react-query';
import { handleApiError } from './error-handlers';

// Project type definition
export type Project = {
  id: string;
  name: string;
  description: string;
  account_id: string;
  created_at: string;
  updated_at?: string;
  sandbox: {
    vnc_preview?: string;
    sandbox_url?: string;
    id?: string;
    pass?: string;
  };
  is_public?: boolean;
  [key: string]: any;
};

// Query keys for React Query
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

const getProjects = async (): Promise<Project[]> => {
  try {
    const supabase = createSupabaseClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting current user:', userError);
      return [];
    }

    if (!userData.user) {
      console.log('[API] No user logged in, returning empty projects array');
      return [];
    }

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        threads!inner(thread_id)
      `)
      .eq('account_id', userData.user.id);

    if (error) {
      if (
        error.code === '42501' &&
        error.message.includes('has_role_on_account')
      ) {
        console.error(
          'Permission error: User does not have proper account access',
        );
        return [];
      }
      throw error;
    }

    console.log('[API] Raw projects from DB:', data?.length, data);

    // Map database fields to our Project type
    const mappedProjects: Project[] = (data || []).map((project: any) => ({
      id: project.project_id,
      name: project.name || '',
      description: project.description || '',
      account_id: project.account_id,
      created_at: project.created_at,
      updated_at: project.updated_at,
      sandbox: project.sandbox || {
        id: '',
        pass: '',
        vnc_preview: '',
        sandbox_url: '',
      },
    }));

    console.log('[API] Mapped projects for frontend:', mappedProjects.length);

    return mappedProjects;
  } catch (err) {
    console.error('Error fetching projects:', err);
    handleApiError(err, { operation: 'load projects', resource: 'projects' });
    return [];
  }
};

// React Query hook for projects
export const useProjects = () => {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: async () => {
      const data = await getProjects();
      return data as Project[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}; 