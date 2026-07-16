export const prisma = {};

export default prisma;

export function softDelete() {
  throw new Error("softDelete is not available in unit tests");
}
