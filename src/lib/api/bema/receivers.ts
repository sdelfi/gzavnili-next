import { apiGet, apiPatch, apiPost, apiDelete } from '../http';

export type ListReceiversParams = {
  page: number;
  perPage: number;
  sort: string;
  dir: 'asc' | 'desc';
  search?: string;
  active?: string;
};

export function listReceiversAdmin<TRow>(params: ListReceiversParams) {
  const qs = new URLSearchParams({
    page: String(params.page),
    perPage: String(params.perPage),
    sort: params.sort,
    dir: params.dir,
    ...(params.search ? { search: params.search } : {}),
    ...(params.active ? { active: params.active } : {}),
  });
  return apiGet<{ items: TRow[]; total: number }>(`/api/bema/receivers?${qs.toString()}`);
}

export function getReceiver<TReceiver>(id: string) {
  return apiGet<{ receiver: TReceiver }>(`/api/bema/receivers/${id}`);
}

export function createReceiver<TReceiver>(payload: unknown) {
  return apiPost<{ receiver: TReceiver }>('/api/bema/receivers', payload);
}

export function updateReceiver<TReceiver>(id: string, payload: unknown) {
  return apiPatch<{ receiver: TReceiver }>(`/api/bema/receivers/${id}`, payload);
}

export function deleteReceiver(id: string) {
  return apiDelete(`/api/bema/receivers/${id}`);
}
