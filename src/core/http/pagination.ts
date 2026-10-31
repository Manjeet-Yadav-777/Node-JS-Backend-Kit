export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginatedMeta {
  const safeLimit = limit > 0 ? limit : 20;
  const totalPages = Math.ceil(total / safeLimit);
  return {
    page,
    limit: safeLimit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
