import { apiGet, apiPatch, apiPost } from '../http';

// bema "Georgian Offices" admin CRUD — see docs/decisions/0030-georgian-offices.md. Distinct
// from `listDeliveryOffices()` in `lib/api/bema/parcels.ts`, which backs the flat office
// *picker* dropdown other screens use (unaffected by this module).

export type DeliveryOffice = {
  id: string;
  city: string | null;
  officeName: string;
  officeNameGe: string | null;
  letter: string | null;
  active: boolean;
};

export type ListDeliveryOfficesParams = {
  page: number;
  perPage: number;
  sort: string;
  dir: 'asc' | 'desc';
  search?: string;
  active?: string;
};

export function listDeliveryOfficesAdmin(params: ListDeliveryOfficesParams) {
  const qs = new URLSearchParams({
    page: String(params.page),
    perPage: String(params.perPage),
    sort: params.sort,
    dir: params.dir,
    ...(params.search ? { search: params.search } : {}),
    ...(params.active !== undefined ? { active: params.active } : {}),
  });
  return apiGet<{ items: DeliveryOffice[]; total: number }>(`/api/bema/config/offices?${qs.toString()}`);
}

export function getDeliveryOffice(id: string) {
  return apiGet<{ office: DeliveryOffice }>(`/api/bema/config/offices/${id}`);
}

export type DeliveryOfficePayload = {
  city: string;
  officeName: string;
  officeNameGe?: string | null;
  letter: string;
  active: boolean;
};

export function createDeliveryOffice(payload: DeliveryOfficePayload) {
  return apiPost<{ office: DeliveryOffice }>('/api/bema/config/offices', payload);
}

export function updateDeliveryOffice(id: string, payload: DeliveryOfficePayload) {
  return apiPatch<{ office: DeliveryOffice }>(`/api/bema/config/offices/${id}`, payload);
}
