import { apiGet } from '../http';

export type ParcelsReportQuery = { dateStart: string; dateEnd: string };

export type PaidTransactionRow = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  trackingNum: string;
  service: string | null;
  weight: number | null;
  payAmount: number | null;
  payMethod: string | null;
  debt: number | null;
  receivedBy: string;
  editDateTime: string;
};

export type TotalSaleBuckets = Record<
  'Express' | 'Regular' | 'Cargo' | 'Linoli' | 'Unknown' | 'Total',
  { weight: number; cost: number }
>;

export type KeyedAmount = { key: string; amount: number };

export type HistoryRow = {
  id: string;
  editDateTime: string;
  editStatus: string | null;
  oldValue: string | null;
  newValue: string | null;
  valueName: string | null;
  payMethod: string | null;
  payAmount: number | null;
};

export type ParcelsReport = {
  transactions: PaidTransactionRow[];
  transactionsTotals: { weight: number; payAmount: number; debt: number };
  totalSale: TotalSaleBuckets;
  paymentCollected: KeyedAmount[];
  paymentCollectedTotal: number;
  remainPayment: KeyedAmount[];
  remainPaymentTotal: number;
  collectedUs: KeyedAmount[];
  collectedUsTotal: number;
  collectedGe: KeyedAmount[];
  collectedGeTotal: number;
  history: HistoryRow[];
};

export function getParcelsReport(query: ParcelsReportQuery) {
  const params = new URLSearchParams({ dateStart: query.dateStart, dateEnd: query.dateEnd });
  return apiGet<ParcelsReport>(`/api/bema/parcels/reports?${params.toString()}`);
}
