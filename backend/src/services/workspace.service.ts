import { workspaceRepository } from '../repositories/workspace.repository';
import { userRepository } from '../repositories/user.repository';
import { ProblemDetails } from '../errors';
import { emailQueue } from '../queue';

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

        const userToInvite = await userRepository.findByEmail(email);
        if (!userToInvite) {
            throw new ProblemDetails({
                title: 'User Not Found',
                status: 404,
                detail: 'No user found with this email. Please ask them to register first.',
            });
        }

        const existingMembership = await workspaceRepository.checkMembership(workspaceId, userToInvite.id);
        if (existingMembership) {
            throw new ProblemDetails({
                title: 'Already a Member',
                status: 400,
                detail: 'This user is already a member of the workspace.',
            });
        }

        await workspaceRepository.addMember(workspaceId, userToInvite.id, 'MEMBER');

        await emailQueue.add('sendEmail', {
            to: email,
            subject: 'You have been added to a new workspace',
            text: `You have been added to a workspace by another member. Log in to your dashboard to view your new workspace tasks.`
        });

        return { message: 'Member invited successfully.' };
    }

    // Feature 1: Get workspace members for task assignment
    async getWorkspaceMembers(workspaceId: string) {
        return await workspaceRepository.getMembers(workspaceId);
    }
}

export const workspaceService = new WorkspaceService();
