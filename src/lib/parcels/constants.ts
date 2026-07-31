// Every option list / label map on the bema parcels screen, in one place because both the
// API (export CSV, operation validation) and half a dozen components need the same values.
// All of it is transcribed from the legacy `views/parcels/vwParcels_work2.cfm` (the view
// `bema/parcels/parcels.cfm` actually includes) and `MSSQLParcelDAO.getParcels()`/
// `doOperation()` — option *values* are kept verbatim from legacy (`d|P`, `NotDeclared`,
// `processingCustom`, `Cash GE`, …) since several of them are also stored in the database
// (`parcels.service`/`parcelType`/`payMethod1`), so renaming them here would silently stop
// matching real rows. The query-parameter *names* around them are this project's own
// (`perPage`/`search`/`receivedBy`, not `perpg`/`kys`/`eadmin`) — see parcelSchema.ts.

export type SelectOptionLike = { value: string; label: string };

export const PER_PAGE_OPTIONS: SelectOptionLike[] = ['25', '50', '75', '100', '250', '500'].map((v) => ({
  value: v,
  label: v,
}));

// One flat dropdown in legacy, with `--Service--`/`--Delivery--`/`--Type--` separator rows
// and three different meanings encoded in the value prefix (`d|` = tracking-number prefix,
// `p|` = parcel type, bare = service). Kept as real option groups here instead of
// unselectable separator `<option>`s.
export const SERVICE_FILTER_GROUPS: { label: string; options: SelectOptionLike[] }[] = [
  {
    label: 'Service',
    options: [
      { value: 'Regular', label: 'Regular' },
      { value: 'Express', label: 'Express' },
      { value: 'Cargo', label: 'Cargo' },
    ],
  },
  {
    label: 'Delivery',
    options: [
      { value: 'd|P', label: 'Pickup' },
      { value: 'd|D', label: 'Delivery' },
      { value: 'd|R', label: 'Region' },
    ],
  },
  {
    label: 'Type',
    options: [
      { value: 'p|Online', label: 'Online' },
      { value: 'p|Personal', label: 'Personal' },
      { value: 'p|Bussiness', label: 'Bussiness' },
    ],
  },
  {
    label: '',
    options: [{ value: 'NotDeclared', label: 'Not Declared' }],
  },
];

export const CITY_FILTER_OPTIONS: SelectOptionLike[] = [
  { value: '', label: 'Any city' },
  { value: '1', label: 'Tbilisi' },
  { value: '2', label: 'Not Tbilisi' },
];

export const PAID_FILTER_OPTIONS: SelectOptionLike[] = [
  { value: '', label: 'Any' },
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
];

// The main "Status:" filter. Values are the legacy ones; see `buildStatusFilter()` in
// src/lib/services/parcelQuery.ts for what each actually matches.
export const STATUS_FILTER_OPTIONS: SelectOptionLike[] = [
  { value: '', label: 'Any status' },
  { value: 'OnHold', label: 'OnHold' },
  { value: 'NotOnHold', label: 'Removed from OnHold' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'office', label: 'Received in Tbilisi office' },
  { value: 'processingCustom', label: 'Processing Custom' },
  { value: 'custom', label: 'Process Custom Clearance' },
  { value: 'outdelivery', label: 'Out of Delivery' },
  { value: 'Delay', label: 'Delay' },
  { value: 'received', label: 'Received in USA' },
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'region', label: 'Send to Region' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'paid', label: 'Paid' },
];

// The second ("extra search") status filter. Narrower list than the main one: it drives a
// milestone *timestamp range* query (From/To date+time), so only statuses backed by a real
// timestamp column appear, and — unlike the main filter — it does not exclude parcels that
// have since moved further along.
export const EXTRA_STATUS_FILTER_OPTIONS: SelectOptionLike[] = [
  { value: '', label: 'All' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'office', label: 'Received in Tbilisi office' },
  { value: 'processingCustom', label: 'Processing Custom' },
  { value: 'custom', label: 'Process Custom Clearance' },
  { value: 'outdelivery', label: 'Out of Delivery' },
  { value: 'Delay', label: 'Delay' },
  { value: 'received', label: 'Received in USA' },
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'region', label: 'Send to Region' },
  { value: 'shipped', label: 'Shipped' },
];

export const SORT_OPTIONS: SelectOptionLike[] = [
  { value: 'Created', label: 'Created' },
  { value: 'TripDate', label: 'Trip Date' },
  { value: 'TrackingNum', label: 'Tracking #' },
  { value: 'TrackingNum2', label: 'Tracking # 2' },
];

// --- Parcel edit form --------------------------------------------------------------------

// The Service dropdown on the parcel form. Values are stored in `parcels.service`; three of
// them display under a different name (see `serviceLabel` below), which is why this list is
// not just `SERVICE_FILTER_GROUPS` flattened — the filter dropdown offers `Cargo` and the
// delivery/type prefixes, the form offers what a parcel can actually *be*.
export const SERVICE_OPTIONS: SelectOptionLike[] = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Express', label: 'Express' },
  { value: 'Online', label: 'Online Shopping' },
  { value: 'Economy', label: 'Philadelphia' },
  { value: 'saveez', label: 'Saveez.com' },
  { value: 'Cargo', label: 'Cargo' },
];

// Legacy's `listContents` — a shortcut list, not a closed set: the field accepts free text
// and stores whatever it holds (legacy achieved the same with a paired "Other" text box).
export const PARCEL_CONTENTS = [
  'Accessories',
  'Baby Swing',
  'Bags',
  'Books',
  'Car Parts',
  'Cell Phones',
  'Clothes',
  'Computer',
  'Computer Parts',
  'Cosmetics',
  'Food',
  'Home Electronics',
  'Household Googs',
  'Laptop',
  'Legal Documents',
  'Medications',
  'Musical Instruments',
  'Older Care',
  'Perfume',
  'Photo Cameras',
  'Shoes',
  'Sporting Goods',
  'Strollers',
  'Supplements',
  'Sweets',
  'Tools',
  'Toys',
  'Watches',
];

// --- Bulk operations ---------------------------------------------------------------------

export const PARCEL_OPERATIONS = [
  'delete',
  'estdelivery',
  'delivered',
  'office',
  'processingCustom',
  'custom',
  'delay',
  'outdelivery',
  'received',
  'awaiting',
  'region',
  'shipped',
  'paid',
  'unpaid',
  'change_code',
  'awb',
] as const;

export type ParcelOperation = (typeof PARCEL_OPERATIONS)[number];

// Exactly the operations the legacy list screen's `<select name="operation">` offers, in
// its order. `received`/`unpaid` are deliberately absent: `doOperation()` implements both,
// but the list screen's dropdown has `received` commented out and never offered `unpaid` —
// they stay reachable through the API for the screens that do use them (money-collect),
// not from this dropdown.
export const OPERATION_OPTIONS: SelectOptionLike[] = [
  { value: '', label: '< Choose an operation >' },
  { value: 'delete', label: 'Delete' },
  { value: 'estdelivery', label: 'Set Status - Estimate Delivery' },
  { value: 'delivered', label: 'Set Status - Delivered' },
  { value: 'office', label: 'Set Status - Received in Tbilisi office' },
  { value: 'processingCustom', label: 'Set Status - Processing Custom' },
  { value: 'custom', label: 'Set Status - Process Custom Clearance' },
  { value: 'delay', label: 'Set Status - Delay' },
  { value: 'outdelivery', label: 'Set Status - Out of Delivery' },
  { value: 'region', label: 'Set Status - Send to Region' },
  { value: 'shipped', label: 'Set Status - Shipped' },
  { value: 'paid', label: 'Set Status - Paid' },
  { value: 'change_code', label: 'Change code' },
  { value: 'awb', label: 'Set AWB' },
];

// Operations whose date is a real point in time rather than a calendar day — the legacy
// datepicker switches its format from `MM/dd/yyyy` to `MM/dd/yyyy hh:mm a` for exactly
// this set (`operationSelect`'s change handler in vwParcels_work2.cfm).
export const DATETIME_OPERATIONS: ReadonlySet<string> = new Set([
  'outdelivery',
  'delivered',
  'region',
  'office',
  'processingCustom',
]);

// Payment methods. The legacy list renders a different middle block depending on whether the
// acting admin's own billing country is Georgia — GE-specific instruments for a GE-based
// admin, US ones otherwise — with the two GE options and PayPal/PayBox always present.
const PAY_METHODS_COMMON_TOP: SelectOptionLike[] = [
  { value: 'Cash GE', label: 'Cash in Georgia' },
  { value: 'CreditCard GE', label: 'Credit Card GE' },
];
const PAY_METHODS_GE: SelectOptionLike[] = [
  { value: 'Check GE', label: 'Check GE' },
  { value: 'Bank Deposit GE', label: 'Bank Deposit GE' },
  { value: 'Wire Transfer GE', label: 'Wire Transfer GE' },
];
const PAY_METHODS_US: SelectOptionLike[] = [
  { value: 'Cash', label: 'Cash in USA' },
  { value: 'CreditCard', label: 'Credit Card USA' },
  { value: 'Check', label: 'Check' },
  { value: 'Bank Deposit', label: 'Bank Deposit' },
  { value: 'Wire Transfer', label: 'Wire Transfer' },
];
const PAY_METHODS_COMMON_BOTTOM: SelectOptionLike[] = [
  { value: 'PayPal', label: 'PayPal' },
  { value: 'PayBox', label: 'PayBox' },
];

export function payMethodOptions(adminCountry: string | null | undefined): SelectOptionLike[] {
  return [
    { value: '', label: 'Select Payment method*' },
    ...PAY_METHODS_COMMON_TOP,
    ...(adminCountry === 'GE' ? PAY_METHODS_GE : PAY_METHODS_US),
    ...PAY_METHODS_COMMON_BOTTOM,
  ];
}

// --- Display helpers ---------------------------------------------------------------------

// Legacy renames three service values on display only (the stored value stays as-is).
export function serviceLabel(service: string | null | undefined): string {
  if (!service) return '';
  if (service === 'Saveez') return 'Saveez.com';
  if (service === 'online') return 'Online Shopping';
  if (service === 'Economy') return 'Philadelphia';
  return service;
}

// Hour/minute dropdowns of the "extra search" From/To range: whole hours, 5-minute steps.
export const HOUR_OPTIONS: SelectOptionLike[] = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}));
export const MINUTE_OPTIONS: SelectOptionLike[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i * 5),
  label: String(i * 5).padStart(2, '0'),
}));
