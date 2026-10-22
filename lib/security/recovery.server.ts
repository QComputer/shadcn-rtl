import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db-runtime";
import { AccountSecurityError, auditCredentialChange, validateNewPassword } from "./password.server";

export const RECOVERY_UNAVAILABLE = "بازیابی خودکار هنوز به کانال هویتی تأییدشده متصل نیست. برای بررسی هویت با مدیر سازمان تماس بگیرید؛ رمز یا کد امنیتی خود را ارسال نکنید.";
export const RECOVERY_ACKNOWLEDGEMENT = "اگر حساب واجد شرایطی وجود داشته باشد، راهنمای بازیابی از طریق کانال تأییدشده ارسال می‌شود.";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Server-owned adapter only. No production sender exists until a verified channel is integrated. */
export interface VerifiedRecoveryChannel {
  deliver(input: { verifiedEmail: string; token: string; expiresAt: Date }): Promise<void>;
}

export class PasswordRecoveryService {
  constructor(private db: PrismaClient = prisma, private channel: VerifiedRecoveryChannel | null = null) {}
  get available() { return this.channel !== null; }

  private async limit(ip: string, phase: "request" | "consume") {
    const key = digest(`recovery:${phase}:${ip}`);
    await this.db.$transaction(async tx => {
      // Durable across instances; concurrent requests share one database lock.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
      const count = await tx.auditLog.count({ where: { entityType: "AccountRecoveryAttempt", entityId: key,
        createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } });
      if (count >= (phase === "request" ? 5 : 10)) throw new AccountSecurityError(429, "تلاش‌های زیادی انجام شده است؛ ۱۵ دقیقه دیگر دوباره امتحان کنید.");
      await tx.auditLog.create({ data: { action: "UPDATE", entityType: "AccountRecoveryAttempt", entityId: key,
        description: `Account recovery ${phase} attempt; no credential data recorded` } });
    });
  }

  async request(identifier: string, ip: string): Promise<void> {
    if (!this.channel) throw new AccountSecurityError(503, RECOVERY_UNAVAILABLE);
    await this.limit(ip, "request");
    const normalized = identifier.trim().toLowerCase();
    const matches = await this.db.user.findMany({ where: { isActive: true, deletedAt: null,
      OR: [{ name: { equals: normalized, mode: "insensitive" } }, { email: normalized }] }, take: 2,
      select: { id: true, email: true } });
    if (matches.length !== 1 || !matches[0].email) return;
    const user = matches[0];
    const verified = await this.db.emailVerification.findFirst({ where: { userId: user.id, email: user.email!,
      verifiedAt: { not: null, lte: new Date() } }, select: { id: true } });
    if (!verified) return;
    const token = randomBytes(32).toString("base64url"), tokenHash = digest(`password-recovery-v1:${token}`);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const current = await tx.user.findFirst({ where: { id: user.id, email: user.email, isActive: true, deletedAt: null }, select: { id: true } });
      if (!current) throw new AccountSecurityError(400, "درخواست قابل انجام نیست.");
      // Account-scoped throttling applies even when an attacker rotates IPs.
      const recent = await tx.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } });
      if (recent >= 3) return;
      await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordReset.create({ data: { userId: user.id, token: tokenHash, expiresAt } });
    });
    const issued = await this.db.passwordReset.findUnique({ where: { token: tokenHash }, select: { id: true } });
    if (!issued) return;
    try { await this.channel.deliver({ verifiedEmail: user.email!, token, expiresAt }); }
    catch {
      await this.db.passwordReset.updateMany({ where: { token: tokenHash, usedAt: null }, data: { usedAt: new Date() } });
      // Same acknowledgement for absent account, unverified address or failed delivery.
    }
  }

  async consume(token: string, newPassword: string, ip: string) {
    if (!this.channel) throw new AccountSecurityError(503, RECOVERY_UNAVAILABLE);
    await this.limit(ip, "consume");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AccountSecurityError(400, "پیوند بازیابی نامعتبر، منقضی یا قبلاً استفاده شده است.");
    validateNewPassword(newPassword);
    const tokenHash = digest(`password-recovery-v1:${token}`);
    const found = await this.db.passwordReset.findUnique({ where: { token: tokenHash }, select: { userId: true } });
    const invalid = () => new AccountSecurityError(400, "پیوند بازیابی نامعتبر، منقضی یا قبلاً استفاده شده است.");
    if (!found) throw invalid();
    const password = await hash(newPassword, 12);
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.userId} FOR UPDATE`;
      const user = await tx.user.findFirst({ where: { id: found.userId, isActive: true, deletedAt: null }, select: { id: true } });
      if (!user) throw invalid();
      const claimed = await tx.passwordReset.updateMany({ where: { token: tokenHash, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw invalid();
      await tx.user.update({ where: { id: user.id }, data: { password, failedLoginAttempts: 0, lockedUntil: null } });
      await auditCredentialChange(tx, user.id, user.id, "Account recovered; all previous sessions invalidated");
    });
  }
}

// Deliberately disabled: email sending is incomplete and phone identity is not verified.
// Existing SMS order notifications are not proof of a recovery identity/channel.
export const passwordRecoveryService = new PasswordRecoveryService();
