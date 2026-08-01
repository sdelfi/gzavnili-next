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

// The full bema "Site Settings" screen (legacy `bema/config/settings.cfm`). Date fields are
// `yyyy-mm-dd` (matching `<input type="date">`) or `null` for "not set".
export type SiteSettings = {
  siteMessage: string;
  consignee: string;

  popupEnabled: boolean;
  popupMessageEn: string;
  popupMessageGe: string;

  airwayBill: string;
  airwayDate: string | null;

  dtRegularShip: string | null;
  dtRegularEst: string | null;
  regAwb: string;

  dtExpressShip: string | null;
  dtExpressEst: string | null;
  expAwb: string;

  dtCargoShip: string | null;
  dtCargoEst: string | null;

  crate: string;
  declaredPrice: string;
  nonDeclaredPrice: string;
};

export function getSiteSettings() {
  return apiGet<{ config: SiteSettings }>('/api/bema/config');
}

export function updateSiteSettings(payload: SiteSettings) {
  return apiPatch<{ config: SiteSettings }>('/api/bema/config', payload);
}
