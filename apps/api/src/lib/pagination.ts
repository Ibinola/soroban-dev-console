export interface PaginatedMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: PaginatedMeta;
}

export function normalizePagination(input: {
  page?: number;
  pageSize?: number;
  skip?: number;
  take?: number;
}, defaults: { page?: number; pageSize?: number } = {}) {
  const defaultPage = defaults.page ?? 1;
  const defaultPageSize = defaults.pageSize ?? 20;
  let page = Number.isFinite(input.page as number) ? Number(input.page) : undefined;
  let pageSize = Number.isFinite(input.pageSize as number)
    ? Number(input.pageSize)
    : undefined;

  if (page === undefined || pageSize === undefined) {
    if (Number.isFinite(input.skip as number) || Number.isFinite(input.take as number)) {
      const take = Number.isFinite(input.take as number) ? Number(input.take) : defaultPageSize;
      const skip = Number.isFinite(input.skip as number) ? Number(input.skip) : 0;
      pageSize = Math.min(Math.max(take, 1), 100);
      page = Math.floor(skip / pageSize) + 1;
    }
  }

  page = Math.max(Math.trunc(page ?? defaultPage), 1);
  pageSize = Math.min(Math.max(Math.trunc(pageSize ?? defaultPageSize), 1), 100);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

export function toPaginatedEnvelope<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedEnvelope<T> {
  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      hasNext: page * pageSize < total,
    },
  };
}
