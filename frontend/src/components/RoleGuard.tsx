import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface RoleGuardProps {
    allowedRoles: string[];
    children: React.ReactNode;
    fallback?: string;
}

/**
 * Route-level guard that checks if the current user's workspace role
 * is in the allowedRoles list. Redirects to fallback if unauthorized.
 */
export const RoleGuard = ({ allowedRoles, children, fallback = '/' }: RoleGuardProps) => {
    const user = useAuthStore((s) => s.user);
    const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

    const { data: myMemberData, isLoading } = useQuery({
        queryKey: ['workspaceMemberRole', workspaceId, user?.id],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/members`);
            const me = res.data.find((m: any) => m.userId === user?.id);
            return me;
        },
        enabled: !!workspaceId && !!user?.id,
        staleTime: 5 * 60 * 1000, // Cache for 5 min to avoid re-fetching on every navigation
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-sm text-gray-400">Checking permissions…</div>
            </div>
        );
    }

    if (!myMemberData || !allowedRoles.includes(myMemberData.role)) {
        return <Navigate to={fallback} replace />;
    }

    return <>{children}</>;
};
