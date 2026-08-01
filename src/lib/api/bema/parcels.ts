import { apiDelete, apiGet, apiPatch, apiPost } from '../http';
import type { ParcelListResponse } from '@/lib/parcels/types';
import type { ParcelDetail } from '@/lib/services/parcelDetail';
import type { UpdateParcelPayload } from '@/lib/validation/parcelSchema';
import type { AddParcelBatchPayload, QuickCustomerPayload } from '@/lib/validation/parcelBatchSchema';
import type { DraftParcelResult } from '@/lib/services/parcelBatchAdd';
import type { ParcelOperation } from '@/lib/parcels/constants';
import type { OnlineParcelLookup } from '@/lib/services/parcelOnlineLookup';
import type { CreateOnlineParcelPayload, UpdateOnlineParcelPayload } from '@/lib/validation/parcelOnlineAddSchema';
import type { ChangeParcelStatusPayload } from '@/lib/validation/parcelChangeStatusSchema';

// Typed client for /api/bema/parcels/* — see AGENTS.md's "API calls go through a service
// layer". `ParcelFiltersState` is the single source of truth for what the list screen can
// filter by: it is what the components bind to, what gets serialised into the URL, and what
// gets sent as the querystring, so adding a filter is one edit here plus one in
// listParcelsQuerySchema.

export type ParcelFiltersState = {
  page: number;
  perPage: number;
  sort: 'Created' | 'TripDate' | 'TrackingNum' | 'TrackingNum2';
  dir: 'asc' | 'desc';

  search: string;
  sender: string;
  tripDate: string;
  receivedDate: string;
  service: string;
  groupId: string;
  city: string;
  status: string;
  statusDate: string;
  isPaid: string;
  debt: string;
  userId: string;

  extraStatus: string;
  receivedBy: string;
  fromDate: string;
  fromHour: string;
  fromMinute: string;
  toDate: string;
  toHour: string;
  toMinute: string;

  deliveryRequest: string;
};

export const EMPTY_PARCEL_FILTERS: ParcelFiltersState = {
  page: 1,
  perPage: 25,
  sort: 'Created',
  dir: 'desc',
  search: '',
  sender: '',
  tripDate: '',
  receivedDate: '',
  service: '',
  groupId: '',
  city: '',
  status: '',
  statusDate: '',
  isPaid: '',
  debt: '',
  userId: '',
  extraStatus: '',
  receivedBy: '',
  fromDate: '',
  fromHour: '0',
  fromMinute: '0',
  toDate: '',
  toHour: '0',
  toMinute: '0',
  deliveryRequest: '',
};

/** Serialises the filter state for both the URL and the API, dropping anything that isn't
 *  actually filtering — so a bookmarked list URL reads as the filters the operator set. */
export function parcelFiltersToQuery(filters: ParcelFiltersState): URLSearchParams {
  const omit = new Set<string>();
  // The hour/minute parts only mean anything next to their date.
  if (!filters.fromDate) omit.add('fromHour').add('fromMinute');
  if (!filters.toDate) omit.add('toHour').add('toMinute');
  if (filters.page === 1) omit.add('page');

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const text = String(value ?? '');
    if (text === '' || omit.has(key)) continue;
    params.set(key, text);
  }
  return params;
}

/** Inverse of `parcelFiltersToQuery`, for restoring state from the URL on load. */
export function parcelFiltersFromQuery(params: URLSearchParams): ParcelFiltersState {
  const read = (key: keyof ParcelFiltersState) => params.get(key) ?? '';
  return {
    ...EMPTY_PARCEL_FILTERS,
    ...Object.fromEntries(
      (Object.keys(EMPTY_PARCEL_FILTERS) as (keyof ParcelFiltersState)[])
        .filter((key) => params.has(key))
        .map((key) => [key, read(key)]),
    ),
    // The three numeric/union fields need their own coercion — everything else is a string.
    page: Number(params.get('page') ?? 1) || 1,
    perPage: Number(params.get('perPage') ?? 25) || 25,
    sort: (params.get('sort') as ParcelFiltersState['sort']) || 'Created',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };
}

export function listParcels(filters: ParcelFiltersState) {
  return apiGet<ParcelListResponse>(`/api/bema/parcels?${parcelFiltersToQuery(filters).toString()}`);
}

export function parcelsExportUrl(filters: ParcelFiltersState) {
  return `/api/bema/parcels/export?${parcelFiltersToQuery(filters).toString()}`;
}

// Legacy's airway export ignores whatever filters were applied on screen (it never lists any
// rows at all — see the route's own comment), so there is no filter state to carry here.
export function parcelsAirwayExportUrl() {
  return '/api/bema/parcels/export-airway';
}

export type ParcelOperationPayload = {
  operation: ParcelOperation;
  parcelIds: string[];
  operationDate?: string;
  payMethod1?: string;
  pCode?: string;
  awb?: string;
  buser?: string;
};

export type ParcelOperationResponse = {
  operation: ParcelOperation;
  affected: number;
  skipped: { id: string; reason: string }[];
};

export function runParcelOperation(payload: ParcelOperationPayload) {
  return apiPost<ParcelOperationResponse>('/api/bema/parcels/operations', payload);
}

export function deleteParcel(id: string) {
  return apiDelete(`/api/bema/parcels/${id}`);
}

/** Clears both hold flags, letting the parcel's status fall back to its real milestone —
 *  the "Removed from On Hold → Confirm" action on the list. */
export function clearParcelHold(id: string) {
  return apiPost(`/api/bema/parcels/${id}/clear-hold`);
}

// --- Parcel edit ---------------------------------------------------------------------------

export function getParcel(id: string) {
  return apiGet<{ parcel: ParcelDetail }>(`/api/bema/parcels/${id}`);
}

export function updateParcel(id: string, payload: UpdateParcelPayload) {
  return apiPatch<{ parcel: ParcelDetail }>(`/api/bema/parcels/${id}`, payload);
}

/** Advisory duplicate check while typing; the save re-checks server-side. */
export function checkTrackingNum(trackingNum: string, excludeId?: string) {
  const qs = new URLSearchParams({ trackingNum, ...(excludeId ? { excludeId } : {}) });
  return apiGet<{ exists: boolean }>(`/api/bema/parcels/check-tracking?${qs.toString()}`);
}

export type ReceiverOption = {
  id: string;
  label: string;
  isGeCitizen: boolean;
  address: {
    firstName: string;
    lastName: string;
    firstNameGe: string;
    lastNameGe: string;
    organization: string;
    country: string;
    street1: string;
    street2: string;
    city: string;
    state: string;
    postalCode: string;
    phone1: string;
    phone2: string;
    phone3: string;
  };
};

export function listReceivers(userId: string) {
  return apiGet<{ receivers: ReceiverOption[] }>(`/api/bema/receivers?userId=${encodeURIComponent(userId)}`);
}

export function listDeliveryOffices() {
  return apiGet<{ offices: { id: string; label: string }[] }>('/api/bema/delivery-offices');
}

/** How many other parcels already carry this code — a non-zero count is what the "Change
 *  code" operation warns about before reusing it. */
export function checkParcelCode(pcode: string) {
  return apiGet<{ count: number }>(`/api/bema/parcels/check-code?pcode=${encodeURIComponent(pcode)}`);
}

// --- Batch "Add Parcel" -------------------------------------------------------------------

/** The customer box's "Save"/"Update" button — creates or refreshes a customer's name/
 *  billing address immediately, ahead of drafting any parcels for them. */
export function saveQuickCustomer(payload: QuickCustomerPayload) {
  return apiPost<{ userId: string }>('/api/bema/parcels/quick-customer', payload);
}

export function createParcelsBatch(payload: AddParcelBatchPayload) {
  return apiPost<{ parcels: DraftParcelResult[] }>('/api/bema/parcels/batch', payload);
}

// --- "Add Online Parcel" ------------------------------------------------------------------

/** Legacy `bema/ajax/getParcel.cfm` — the tracking-number-driven lookup this screen's whole
 *  flow hinges on. `null` when nothing matches. */
export function lookupOnlineParcel(trackingNum: string, options?: { cutLength?: number; withTrackingNum2?: boolean }) {
  const qs = new URLSearchParams({ trackingNum });
  if (options?.cutLength !== undefined) qs.set('cutLength', String(options.cutLength));
  if (options?.withTrackingNum2 !== undefined) qs.set('withTrackingNum2', options.withTrackingNum2 ? '1' : '0');
  return apiGet<{ parcel: OnlineParcelLookup | null }>(`/api/bema/parcels/online-lookup?${qs.toString()}`);
}

export function createOnlineParcel(payload: CreateOnlineParcelPayload) {
  return apiPost<{ parcel: { id: string; trackingNum: string } }>('/api/bema/parcels/online-add', payload);
}

export function updateOnlineParcel(id: string, payload: UpdateOnlineParcelPayload) {
  return apiPatch<{ parcel: { id: string } }>(`/api/bema/parcels/online-add/${id}`, payload);
}

// --- "Change Parcel status" ---------------------------------------------------------------

export function changeParcelStatus(id: string, payload: ChangeParcelStatusPayload) {
  return apiPatch<{ ok: true }>(`/api/bema/parcels/${id}/change-status`, payload);
}
