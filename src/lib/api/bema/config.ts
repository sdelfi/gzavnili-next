import { apiGet, apiPatch } from '../http';

export type TripInfo = {
  shipDate: string | null;
  estimateDate: string | null;
  awb: string | null;
};

export type TripInfoResponse = {
  express: TripInfo;
  regular: TripInfo;
  cargo: TripInfo;
};

export function getTripInfo() {
  return apiGet<TripInfoResponse>('/api/bema/config/trip-info');
}

export type PopupConfig = {
  popupEnabled: boolean;
  popupMessageEn: string;
  popupMessageGe: string;
};

export function getPopupConfig() {
  return apiGet<{ config: PopupConfig }>('/api/bema/config');
}

export function updatePopupConfig(payload: PopupConfig) {
  return apiPatch<{ config: PopupConfig }>('/api/bema/config', payload);
}
