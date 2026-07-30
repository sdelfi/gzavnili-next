import { apiDelete, apiGet, apiPatch, apiPost } from '../http';

export type ListPagesParams = {
  page: number;
  perPage: number;
  sort: string;
  dir: 'asc' | 'desc';
  search?: string;
  locale?: string;
};

export function listPages<TRow>(params: ListPagesParams) {
  const qs = new URLSearchParams({
    page: String(params.page),
    perPage: String(params.perPage),
    sort: params.sort,
    dir: params.dir,
    ...(params.search ? { search: params.search } : {}),
    ...(params.locale ? { locale: params.locale } : {}),
  });
  return apiGet<{ items: TRow[]; total: number }>(`/api/bema/pages?${qs.toString()}`);
}

export function getPage<TPage>(id: string) {
  return apiGet<{ page: TPage }>(`/api/bema/pages/${id}`);
}

export function createPage<TPage>(payload: unknown) {
  return apiPost<{ page: TPage }>('/api/bema/pages', payload);
}

export function updatePage<TPage>(id: string, payload: unknown) {
  return apiPatch<{ page: TPage }>(`/api/bema/pages/${id}`, payload);
}

export function deletePage(id: string) {
  return apiDelete(`/api/bema/pages/${id}`);
}
