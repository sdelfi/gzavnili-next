import { apiGet, apiPost } from '../http';

export type MoneyCollectQuery = { dateStart: string; dateEnd: string; country?: 'us' | 'ge' };

export type MoneyCollectGroupRow = {
  updaterId: string;
  userId: string;
  updaterUsername: string | null;
  updaterDisplayName: string;
  dateKey: string;
  cash: number;
  creditCard: number;
  creditCardGe: number;
  bankDeposit: number;
  wireTransfer: number;
  check: number;
  paypal: number;
  authorize: number;
  total: number;
  collected: number | null;
  aCash: number | null;
  aCreditCard: number | null;
  aBankDeposit: number | null;
  aWireTransfer: number | null;
  collectorUsername: string | null;
  gDate: string | null;
};

export type BemaManagerOption = { username: string; firstName: string | null; lastName: string | null };

export type MoneyCollectReport = {
  groups: MoneyCollectGroupRow[];
  managers: BemaManagerOption[];
};

export function getMoneyCollectReport(query: MoneyCollectQuery) {
  const params = new URLSearchParams({ dateStart: query.dateStart, dateEnd: query.dateEnd });
  if (query.country) params.set('country', query.country);
  return apiGet<MoneyCollectReport>(`/api/bema/parcels/money-collect?${params.toString()}`);
}

export type CollectMoneyInput = {
  userId: string;
  cDate: string;
  aCash: number;
  aCreditCard: number;
  aBankDeposit: number;
  aWireTransfer: number;
  aTotal: number;
  collectorUsername: string;
  gDate: string;
  password: string;
};

export function collectMoney(input: CollectMoneyInput) {
  return apiPost<{ ok: true }>('/api/bema/parcels/money-collect/collect', input).then((result) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('bema:money-collected'));
    return result;
  });
}

export function getTodayCollectedTotal() {
  return apiGet<{ total: number }>('/api/bema/parcels/money-collect/today');
}
