import "server-only";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/db-runtime";
import type { Prisma, PrismaClient } from "@prisma/client";

export class AccountSecurityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function validateNewPassword(password: string) {
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new AccountSecurityError(400, "رمز جدید باید حداقل ۸ نویسه و حداکثر ۷۲ بایت باشد.");
  }
}

export async function auditCredentialChange(tx: Prisma.TransactionClient, userId: string, actorId: string, reason: string) {
  await tx.auditLog.create({ data: { action: "RESET_PASSWORD", entityType: "User", entityId: userId,
    userId: actorId, description: reason, newValue: { allPreviousSessionsRevoked: true } } });
  await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
}

export async function changeAccountPassword(userId: string, currentPassword: string, newPassword: string, db: PrismaClient = prisma) {
  validateNewPassword(newPassword);
  const user = await db.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { password: true } });
  if (!user || !await compare(currentPassword, user.password)) {
    throw new AccountSecurityError(400, "رمز عبور فعلی صحیح نیست.");
  }
  if (await compare(newPassword, user.password)) throw new AccountSecurityError(400, "رمز جدید باید با رمز فعلی متفاوت باشد.");
  const password = await hash(newPassword, 12);
  await db.$transaction(async tx => {
    const updated = await tx.user.updateMany({ where: { id: userId, password: user.password, isActive: true, deletedAt: null },
      data: { password, failedLoginAttempts: 0, lockedUntil: null } });
    if (updated.count !== 1) throw new AccountSecurityError(409, "اطلاعات امنیتی تغییر کرده است؛ دوباره وارد شوید.");
    await auditCredentialChange(tx, userId, userId, "Password changed; all previous sessions invalidated, including current session");
  }, { timeout: 15000 });
}
