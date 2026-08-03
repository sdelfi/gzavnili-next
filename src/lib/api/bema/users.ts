import { apiGet, apiPatch, apiPost } from '../http';

export type ListUsersParams = {
  accountType: 'BemaUser' | 'Customer';
  page: number;
  perPage: number;
  sort: string;
  dir: 'asc' | 'desc';
  search?: string;
  active?: string;
};

export function listUsers<TRow>(params: ListUsersParams) {
  const qs = new URLSearchParams({
    accountType: params.accountType,
    page: String(params.page),
    perPage: String(params.perPage),
    sort: params.sort,
    dir: params.dir,
    ...(params.search ? { search: params.search } : {}),
    ...(params.active ? { active: params.active } : {}),
  });
  return apiGet<{ items: TRow[]; total: number }>(`/api/bema/users?${qs.toString()}`);
}

export function getUser<TUser>(id: string) {
  return apiGet<{ user: TUser }>(`/api/bema/users/${id}`);
}

export function createUser<TUser>(payload: unknown) {
  return apiPost<{ user: TUser }>('/api/bema/users', payload);
}

export function updateUser<TUser>(id: string, payload: unknown) {
  return apiPatch<{ user: TUser }>(`/api/bema/users/${id}`, payload);
}

export function listMessageTypes() {
  return apiGet<{ messageTypes: { key: string; label: string; labelGe: string | null }[] }>('/api/bema/message-types');
}
