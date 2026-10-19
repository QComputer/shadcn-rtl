import type { Prisma } from "@prisma/client";

export const publicUserSelect = (organizationId?: string) => ({
  id: true, name: true, role: true, isActive: true, isTeamMember: true,
  email: true, firstName: true, lastName: true, phone: true, avatar: true,
  image: true, locale: true, theme: true, createdAt: true, updatedAt: true,
  memberOf: { where: organizationId ? { organizationId } : undefined,
    orderBy: [{ joinedAt: "asc" as const }, { id: "asc" as const }],
    select: { id: true, organizationId: true, organizationSlug: true, role: true, isActive: true } },
} as const satisfies Prisma.UserSelect);

type SafeUser = Prisma.UserGetPayload<{ select: ReturnType<typeof publicUserSelect> }>;
/** Response allowlist, independent of ORM projection. Never spread a User row. */
export function toPublicUserDto(user: SafeUser) {
  return {
    id: user.id, name: user.name, role: user.role, isActive: user.isActive, isTeamMember: user.isTeamMember,
    email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone,
    avatar: user.avatar, image: user.image, locale: user.locale, theme: user.theme,
    createdAt: user.createdAt, updatedAt: user.updatedAt,
    memberOf: user.memberOf.map((member) => ({ id: member.id, organizationId: member.organizationId,
      organizationSlug: member.organizationSlug, role: member.role, isActive: member.isActive })),
  };
}
