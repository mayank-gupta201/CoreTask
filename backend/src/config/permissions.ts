export const ALL_PERMISSIONS = [
    'portfolio:create', 'portfolio:read', 'portfolio:manage',
    'program:create', 'program:read', 'program:manage',
    'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
    'dependency:manage',
    'resource:manage', 'resource:read',
    'timesheet:submit', 'timesheet:approve', 'timesheet:read',
    'report:generate', 'report:manage',
    'dashboard:read',
    'workspace:manage',
] as const;

export type PermissionString = typeof ALL_PERMISSIONS[number];

export type RolePermissions = {
    [key: string]: PermissionString[];
};

const permissionsConfig: RolePermissions = {
    OWNER: [...ALL_PERMISSIONS],
    ADMIN: [...ALL_PERMISSIONS].filter(p => p !== 'workspace:manage'), // Admins can't manage/delete workspace exactly
    PROJECT_MANAGER: [
        'portfolio:read', 'program:read', 
        'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
        'dependency:manage', 
        'resource:read', 
        'timesheet:approve', 'timesheet:read',
        'report:generate', 'report:manage',
        'dashboard:read'
    ],
    RESOURCE_MANAGER: [
        'portfolio:read', 'program:read',
        'task:read',
        'resource:manage', 'resource:read',
        'timesheet:read', 'timesheet:approve', // Requirement: approve timesheets, manage resources
        'dashboard:read'
    ],
    MEMBER: [
        'portfolio:read', 'program:read',
        'task:create', 'task:read', 'task:update', // Create/edit own tasks handled in business logic
        'timesheet:submit', 'timesheet:read',
        'resource:read',
        'dashboard:read'
    ],
    VIEWER: [
        'portfolio:read', 'program:read',
        'task:read', 
        'resource:read', 
        'timesheet:read', 
        'dashboard:read'
    ]
};

export const getRolePermissions = (role: string): PermissionString[] => {
    return permissionsConfig[role.toUpperCase()] || permissionsConfig['VIEWER'];
};
