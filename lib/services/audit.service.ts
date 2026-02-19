import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AuditAction = 
  | 'user.login'
  | 'user.logout'
  | 'user.register'
  | 'user.update'
  | 'user.delete'
  | 'organization.create'
  | 'organization.update'
  | 'organization.delete'
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  | 'order.create'
  | 'order.update'
  | 'order.cancel'
  | 'appointment.create'
  | 'appointment.update'
  | 'appointment.cancel'
  | 'review.create'
  | 'review.delete'
  | 'member.add'
  | 'member.remove'
  | 'member.role_update'
  | 'settings.update';

export interface CreateAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string;
  organizationId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async create(input: CreateAuditLogInput) {
    const auditLog = await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        organizationId: input.organizationId,
        changes: input.changes as Record<string, unknown> || {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    return auditLog;
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    organizationId?: string;
    entityType?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const { 
      page = 1, 
      pageSize = 50, 
      userId, 
      organizationId,
      entityType,
      action,
      fromDate,
      toDate 
    } = params;

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (organizationId) where.organizationId = organizationId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, Date>).gte = new Date(fromDate);
      if (toDate) (where.createdAt as Record<string, Date>).lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getByEntity(entityType: string, entityId: string, params: {
    page?: number;
    pageSize?: number;
  } = {}) {
    const { page = 1, pageSize = 20 } = params;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType,
          entityId,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({
        where: {
          entityType,
          entityId,
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const auditService = new AuditService();

// Helper function to log changes
export async function logEntityChange(
  entityType: string,
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  userId?: string,
  organizationId?: string
) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = {
        from: before[key],
        to: after[key],
      };
    }
  }

  if (Object.keys(changes).length > 0) {
    await auditService.create({
      action: `${entityType.toLowerCase()}.update` as AuditAction,
      entityType,
      entityId,
      userId,
      organizationId,
      changes,
    });
  }
}
