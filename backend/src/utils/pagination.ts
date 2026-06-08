import { Request } from "express";

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Extracts pagination parameters from query string.
 * Returns null if neither `page` nor `pageSize` are present (backward compat).
 * Defaults: page=1, pageSize=20, max pageSize=100.
 */
export function getPagination(req: Request): PaginationParams | null {
  const { page, pageSize } = req.query;

  if (page === undefined && pageSize === undefined) {
    return null;
  }

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const size = Math.min(
    100,
    Math.max(1, parseInt(pageSize as string, 10) || 20),
  );

  return {
    skip: (pageNum - 1) * size,
    take: size,
    page: pageNum,
    pageSize: size,
  };
}

/**
 * Builds a paginated response object.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  };
}
