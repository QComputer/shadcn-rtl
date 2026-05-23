export type PaginationInput = {
  page?: unknown;
  pageSize?: unknown;
};

export type NormalizedPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

function toPositiveInteger(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : fallback;

  if (!Number.isFinite(numberValue)) return fallback;
  const integerValue = Math.trunc(numberValue);
  return integerValue > 0 ? integerValue : fallback;
}

export function normalizePagination(
  input: PaginationInput = {},
  options: { defaultPageSize?: number; maxPageSize?: number } = {},
): NormalizedPagination {
  const defaultPageSize = options.defaultPageSize ?? 20;
  const maxPageSize = options.maxPageSize ?? 100;
  const page = toPositiveInteger(input.page, 1);
  const pageSize = Math.min(
    toPositiveInteger(input.pageSize, defaultPageSize),
    maxPageSize,
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
