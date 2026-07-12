export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function jsonError(_error: unknown, fallback = "Internal server error") {
  return { status: 500, body: { error: fallback } };
}
