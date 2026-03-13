import prisma from '@/lib/prisma';

// In-memory role cache: userId -> cached user data
type RoleData = { role: string; pageAccess: any; organizationId: string | null; isAdmin: boolean; email: string | null; ts: number };
const roleCache = new Map<string, RoleData>();
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches user role, pageAccess, organizationId, isAdmin in a single cached DB query.
 * Returns null if user not found.
 */
export async function getUserRoleData(userId: string): Promise<Omit<RoleData, 'ts'> | null> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.ts < ROLE_CACHE_TTL) {
    const { ts, ...data } = cached;
    return data;
  }
  try {
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, pageAccess: true, organizationId: true, isAdmin: true, email: true },
    });
    if (!userData) return null;
    roleCache.set(userId, { ...userData, ts: Date.now() });
    return userData;
  } catch {
    return null;
  }
}

/**
 * Checks if a user has admin or manager role.
 * Uses a single cached DB query.
 */
export async function isAdminOrManager(userId: string): Promise<boolean> {
  const data = await getUserRoleData(userId);
  return data?.role === 'ADMIN' || data?.role === 'MANAGER';
}

/**
 * Checks if a user has admin, manager, or supervisor role.
 */
export async function isAdminManagerOrSupervisor(userId: string): Promise<boolean> {
  try {
    const data = await getUserRoleData(userId);
    if (!data) return false;
    if (data.role === 'ADMIN' || data.role === 'MANAGER') return true;
    // supervisor check still needs customRoleId — do minimal extra query only when needed
    const extra = await prisma.user.findUnique({
      where: { id: userId },
      select: { customRoleId: true },
    });
    if (extra?.customRoleId) {
      const customRole = await prisma.customRole.findUnique({
        where: { id: extra.customRoleId },
        select: { name: true },
      });
      if (customRole?.name.toLowerCase().includes('supervisor')) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a user has admin role.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const data = await getUserRoleData(userId);
  return data?.role === 'ADMIN';
}