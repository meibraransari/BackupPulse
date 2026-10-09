export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
  assignedProjects?: string[];
}

/**
 * Checks whether the user has project-restricted RBAC permissions.
 * - Administrators always have global access across all projects.
 * - Operators/Viewers with specific projects assigned are restricted to those projects.
 * - If assignedProjects is empty or contains '*', the user has global access.
 */
export function getProjectScope(user?: AuthenticatedUser): {
  isRestricted: boolean;
  allowedProjects: string[];
} {
  if (!user || user.role === 'admin') {
    return { isRestricted: false, allowedProjects: [] };
  }

  const assigned = (user.assignedProjects || [])
    .map((p) => p.trim())
    .filter((p) => p && p !== '*');

  if (assigned.length === 0) {
    return { isRestricted: false, allowedProjects: [] };
  }

  return { isRestricted: true, allowedProjects: assigned };
}

/**
 * Generates a safe Prisma `where` filter fragment for project names,
 * guarding against unauthorized cross-tenant data leaks.
 */
export function buildProjectWhereClause(
  user: AuthenticatedUser | undefined,
  requestedProject?: string
): { where?: any; error?: string } {
  const { isRestricted, allowedProjects } = getProjectScope(user);

  if (!isRestricted) {
    if (requestedProject && requestedProject !== 'ALL') {
      return { where: { projectName: requestedProject } };
    }
    return { where: {} };
  }

  // Restricted user
  if (requestedProject && requestedProject !== 'ALL') {
    if (!allowedProjects.includes(requestedProject)) {
      return { error: `Forbidden: You do not have access to project '${requestedProject}'.` };
    }
    return { where: { projectName: requestedProject } };
  }

  return { where: { projectName: { in: allowedProjects } } };
}
