import { workspaceRepository } from '../repositories/workspace.repository';
import { userRepository } from '../repositories/user.repository';
import { ProblemDetails } from '../errors';
import { emailQueue } from '../queue';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export class WorkspaceService {
    async createWorkspace(userId: string, name: string) {
        return await workspaceRepository.create({ name, ownerId: userId });
    }

    async getUserWorkspaces(userId: string) {
        return await workspaceRepository.findByUserId(userId);
    }

    async verifyMembership(workspaceId: string, userId: string) {
        return await workspaceRepository.checkMembership(workspaceId, userId);
    }

    async inviteMember(workspaceId: string, inviterId: string, email: string) {
        const inviterMembership = await workspaceRepository.checkMembership(workspaceId, inviterId);
        if (!inviterMembership || (inviterMembership.role !== 'OWNER' && inviterMembership.role !== 'ADMIN')) {
            throw new ProblemDetails({
                title: 'Forbidden',
                status: 403,
                detail: 'Only workspace owners or admins can invite members.',
            });
        }

        // Fetch workspace name and inviter info for the email
        const workspaces = await workspaceRepository.findByUserId(inviterId);
        const workspace = workspaces.find(w => w.id === workspaceId);
        const workspaceName = workspace?.name || 'a workspace';

        const inviter = await userRepository.findById(inviterId);
        const inviterName = inviter?.email?.split('@')[0] || 'A team member';

        const userToInvite = await userRepository.findByEmail(email);

        if (userToInvite) {
            // User exists — check if already a member
            const existingMembership = await workspaceRepository.checkMembership(workspaceId, userToInvite.id);
            if (existingMembership) {
                throw new ProblemDetails({
                    title: 'Already a Member',
                    status: 400,
                    detail: 'This user is already a member of the workspace.',
                });
            }

            // Add user to workspace
            await workspaceRepository.addMember(workspaceId, userToInvite.id, 'MEMBER');

            // Send notification email to existing user
            await emailQueue.add('sendEmail', {
                to: email,
                subject: `You've been invited to join "${workspaceName}" on CoreTask`,
                type: 'WORKSPACE_INVITE_EXISTING',
                payload: {
                    workspaceName,
                    inviterName,
                    loginUrl: `${CLIENT_URL}/login`,
                },
            });

            return { message: 'Invitation sent! The user has been added to the workspace.' };
        } else {
            // User does NOT exist — send a signup invitation email
            const registerUrl = `${CLIENT_URL}/register?email=${encodeURIComponent(email)}`;

            await emailQueue.add('sendEmail', {
                to: email,
                subject: `You've been invited to join "${workspaceName}" on CoreTask`,
                type: 'WORKSPACE_INVITE_NEW',
                payload: {
                    workspaceName,
                    inviterName,
                    registerUrl,
                },
            });

            return { message: 'Invitation sent! The user will need to sign up to join the workspace.' };
        }
    }

    // Feature 1: Get workspace members for task assignment
    async getWorkspaceMembers(workspaceId: string) {
        return await workspaceRepository.getMembers(workspaceId);
    }
}

export const workspaceService = new WorkspaceService();
