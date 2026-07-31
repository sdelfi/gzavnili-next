// The shape of one row on the bema parcels list, and the sender/trip "card" the list groups
// rows into. Shared by the API route that builds it (src/app/api/bema/parcels/route.ts) and
// by the components that render it, so the two can't drift.
//
// Everything is JSON-safe: dates are ISO strings and money is a `number`, since Prisma's
// `Decimal` doesn't survive `JSON.stringify` as anything useful.

export type ParcelListItem = {
  id: string;
  trackingNum: string | null;
  trackingNum2: string | null;
  awb: string | null;
  pcode: string | null;
  groupId: string | null;
  service: string | null;
  parcelType: string | null;
  contents: string | null;
  notes: string | null;
  location: string | null;
  officeName: string | null;
  store: string | null;

  created: string;
  tripDate: string | null;

  weight: number | null;
  value: number | null;
  debt: number | null;
  length: number | null;
  width: number | null;
  high: number | null;
  dimWeight: number | null;

  status: string;
  isPaid: boolean;
  isInvoiced: boolean;
  invoiceId: string | null;
  topFlag: boolean;
  bPaidDelivery: boolean;

  payMethod1: string | null;
  payMethod2: string | null;
  payAmount1: number | null;
  payAmount2: number | null;
  onlineSource: string | null;

  additionalUsername: string | null;
  additionalFirstname: string | null;
  additionalLastname: string | null;
  buser: string | null;
  /** Display name of the `buser` admin, resolved server-side (Delivery Request mode only). */
  buserName: string | null;

  // The 12 milestone timestamps rendered as the row's "Tracking" column.
  trackingAway: string | null;
  trackingReceived: string | null;
  trackingEstDelivery: string | null;
  trackingEstShip: string | null;
  trackingShipped: string | null;
  trackingDelay: string | null;
  trackingCustom: string | null;
  trackingProcessingCustom: string | null;
  trackingOffice: string | null;
  trackingOutDelivery: string | null;
  trackingSendRegion: string | null;
  trackingDeliveredSigned: string | null;

  /** Sender (the account the parcel belongs to). */
  user: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    /** paidAmount − invoiceAmount + balanceAdjust, read from the maintained aggregate. */
    balance: number;
  };

  receiver: {
    firstName: string | null;
    lastName: string | null;
    firstNameGe: string | null;
    lastNameGe: string | null;
    organization: string | null;
    street1: string | null;
    street2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    phone1: string | null;
    phone2: string | null;
    phone3: string | null;
  } | null;

  /** Name of the admin in `trackingReceivedBy`, resolved server-side for the CSV export. */
  receivedByName: string | null;
};

// One card on the list: all parcels a sender shipped on the same trip, in the same group,
// created in the same minute. Built client-side by `groupParcels()`.
export type ParcelGroup = {
  key: string;
  topFlag: boolean;
  user: ParcelListItem['user'];
  groupId: string | null;
  tripDate: string | null;
  /** From the first parcel in the group, matching the legacy header's `#parcels.service#`. */
  service: string | null;
  awb: string | null;
  pcode: string | null;
  parcels: ParcelListItem[];
};

export type ParcelListResponse = {
  items: ParcelListItem[];
  total: number;
  page: number;
  perPage: number;
  /** USD→GEL rate from `config.crate`, used for the "… GEL" secondary amounts. */
  lariRate: number | null;
  /** Whether the server forced a `receivedBy` filter the user did not ask for (see below). */
  forcedReceivedBy: string | null;
};
