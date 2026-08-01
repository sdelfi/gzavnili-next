import { apiGet } from '../http';

export type ParcelsSalesReportQuery = { dateStart: string; dateEnd: string };

export type SalesReportRow = {
  id: string;
  editDateTime: string;
  created: string;
  accNum: string;
  notes: string | null;
  firstName: string | null;
  lastName: string;
  trackingNum: string;
  service: string | null;
  weight: number | null;
  paidAmount: number | null;
  paidClass: string;
  paymentType: string;
  debt: number;
  received: string | null;
  receivedBy: string;
};

export type SalesTotals = {
  cashUs: number;
  cashGe: number;
  ccUs: number;
  ccGe: number;
  check: number;
  deposit: number;
  authorize: number;
  paypal: number;
  balance: number;
};

export type BemaUserOption = { username: string; firstName: string | null; lastName: string | null };

export type ParcelsSalesReport = {
  rows: SalesReportRow[];
  diagnostics: { paymentEventsInRange: number; eligibleEvents: number };
  ttl: SalesTotals;
  tbt: SalesTotals;
  bemaUsers: BemaUserOption[];
};

export function getParcelsSalesReport(query: ParcelsSalesReportQuery) {
  const params = new URLSearchParams({ dateStart: query.dateStart, dateEnd: query.dateEnd });
  return apiGet<ParcelsSalesReport>(`/api/bema/parcels/reports-2?${params.toString()}`);
}
