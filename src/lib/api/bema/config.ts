import { apiGet, apiPatch } from '../http';

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
