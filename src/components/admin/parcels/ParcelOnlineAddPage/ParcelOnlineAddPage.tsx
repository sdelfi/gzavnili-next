'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeading } from '@/components/ui/admin/PageHeading';
import { Field } from '@/components/ui/admin/Field';
import { Input } from '@/components/ui/admin/Input';
import { Select } from '@/components/ui/admin/Select';
import { Checkbox } from '@/components/ui/admin/Checkbox';
import { Button } from '@/components/ui/admin/Button';
import { Alert, ErrorList } from '@/components/ui/admin/Alert';
import { Tabs } from '@/components/ui/admin/Tabs';
import { RadioGroup } from '@/components/ui/admin/RadioGroup';
import { CustomerPicker } from '@/components/ui/admin/CustomerPicker';
import { useBemaAuth } from '@/components/admin/AuthProvider';
import { getTripInfo, type TripInfoResponse } from '@/lib/api/bema/config';
import {
  createOnlineParcel,
  listReceivers,
  lookupOnlineParcel,
  updateOnlineParcel,
  type ReceiverOption,
} from '@/lib/api/bema/parcels';
import { ApiError, extractErrorMessages } from '@/lib/api/http';
import { calculateOnlineDebt, type OnlineService } from '@/lib/parcels/onlinePricing';
import s from './ParcelOnlineAddPage.module.css';

// bema "Add Online Parcel" (`bema/parcels/parcels-online-add-2.cfm`). See
// docs/decisions/0022-parcels-online-add.md for the full trace this was ported from — this
// file follows that doc's section order (lookup → shared fields → tabs → save).

const NOT_CHECK_STORAGE_KEY = 'bema.parcelOnlineAdd.notCheck';

// Legacy `extensions/custom_tags/ubaniselect.cfm`'s Tbilisi district list — English labels,
// since this screen forces `session.language = 'en'` before including it.
const DISTRICTS = [
  'Avlabari',
  'Avchala',
  'Bagebi',
  'Gldani',
  'Gldanula',
  'Didi Digomi',
  'Didube',
  'Digmis Masivi',
  'Elia',
  'Vazisubani',
  'Vake',
  'Varketili',
  'Vashlijvari',
  'Vera',
  'Vedzisi',
  'Zemeli',
  'Temka',
  'Isani',
  'Krtsanisi',
  'Lilo',
  'Mukhiani',
  'Mtatsminda',
  'Navtlugi',
  'Nadzaladevi',
  'Ortachala',
  'Saburtalo',
  'Ssanzona',
  'Svanetis Ubani',
];
const DISTRICT_OPTIONS = [{ value: '', label: '' }, ...DISTRICTS.map((d) => ({ value: d, label: d }))];

const TAB_OPTIONS: { value: ShipperTab; label: string }[] = [
  { value: 'known', label: 'Known Shipper' },
  { value: 'unknown', label: 'Unkown Shipper' },
  { value: 'linoli', label: 'Linoli  Shipper' },
];

const SERVICE_OPTIONS = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Express', label: 'Express' },
  { value: 'Cargo', label: 'Cargo' },
];
const DELIVERY_OPTIONS = [
  { value: 'Pickup', label: 'Pickup' },
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Region', label: 'Region' },
];

// Allow-lists for "can this tracking number be upgraded" — legacy genuinely has three
// different ones, not one, at three different points in the flow. See
// docs/decisions/0022-parcels-online-add.md for the full trace of why they differ.
/** Gates whether a tracking-number lookup opens the edit form at all. */
const ALLOWED_FOR_UPGRADE_UI = ['awaiting', 'notonhold', 'new', 'delay'];
/** The wider, near-toothless re-check just before "Save and add another" actually submits. */
const ALLOWED_FOR_PRESUBMIT = ['awaiting', 'onhold', 'new', 'notonhold', 'delay'];

type ShipperTab = 'known' | 'unknown' | 'linoli';
type Delivery = 'Pickup' | 'Delivery' | 'Region';
type Mode = 'idle' | 'update' | 'blocked' | 'create';

type ReceiverFieldsState = {
  firstName: string;
  lastName: string;
  organization: string;
  city: string;
  state: string;
  street1: string;
  street2: string;
  phone1: string;
  phone2: string;
  phone3: string;
};

const emptyReceiver: ReceiverFieldsState = {
  firstName: '',
  lastName: '',
  organization: '',
  city: '',
  state: '',
  street1: '',
  street2: '',
  phone1: '',
  phone2: '',
  phone3: '',
};

export function ParcelOnlineAddPage() {
  const { user } = useBemaAuth();
  const searchParams = useSearchParams();

  const [tripInfo, setTripInfo] = useState<TripInfoResponse | null>(null);
  useEffect(() => {
    getTripInfo()
      .then(setTripInfo)
      .catch(() => setTripInfo(null));
  }, []);

  // "Do not check tracking number" — legacy remembers this in `session.notcheck` across the
  // whole bema session; there is no equivalent server-side session concept for arbitrary UI
  // toggles in this app (bema is otherwise stateless per-request), so `localStorage` is the
  // closest equivalent — same idiom `Sidebar`'s collapsed state already uses.
  const [notCheck, setNotCheck] = useState(false);
  useEffect(() => {
    Promise.resolve().then(() => setNotCheck(localStorage.getItem(NOT_CHECK_STORAGE_KEY) === 'true'));
  }, []);
  function toggleNotCheck(checked: boolean) {
    setNotCheck(checked);
    localStorage.setItem(NOT_CHECK_STORAGE_KEY, checked ? 'true' : 'false');
  }

  const [trackingNum, setTrackingNum] = useState(() => searchParams.get('trackingnum') ?? '');
  const [trackingNum2, setTrackingNum2] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [blockedStatus, setBlockedStatus] = useState('');
  const [existingParcelId, setExistingParcelId] = useState<string | null>(null);
  /** `window.pexists` — true only right after a lookup found an upgradable parcel. */
  const [pexists, setPexists] = useState(false);
  const [senderLabel, setSenderLabel] = useState('');
  const [receiverLabel, setReceiverLabel] = useState('');
  /** The hidden `#contents`/`#value` fields — pricing-calc inputs only, never submitted. */
  const [lookupContents, setLookupContents] = useState('');
  const [lookupValue, setLookupValue] = useState('');

  const [weight, setWeight] = useState('');
  const [debt, setDebt] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [high, setHigh] = useState('');
  const [dimWeight, setDimWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [parcelName, setParcelName] = useState('');
  const [notify, setNotify] = useState(false);

  const [service, setService] = useState<OnlineService>('Regular');
  const [delivery, setDelivery] = useState<Delivery>('Pickup');
  const [notOnHold, setNotOnHold] = useState(false);

  const [tab, setTab] = useState<ShipperTab>('known');
  const [customer, setCustomer] = useState<{ id: string; label: string } | null>(null);
  const [receivers, setReceivers] = useState<ReceiverOption[]>([]);
  const [receiverId, setReceiverId] = useState('');
  const [receiver, setReceiver] = useState<ReceiverFieldsState>(emptyReceiver);
  const [unknownFirstName, setUnknownFirstName] = useState('');
  const [unknownLastName, setUnknownLastName] = useState('');
  const [linoliFirstName, setLinoliFirstName] = useState('');
  const [linoliLastName, setLinoliLastName] = useState('');
  const [linoliUsername, setLinoliUsername] = useState('');

  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reloads whenever a customer is selected, same as `goUser()`. Cleared explicitly wherever
  // the customer changes to none, rather than reactively here, to keep this effect's only job
  // "fetch for the current customer" (no synchronous setState for the "no customer" case).
  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    listReceivers(customer.id)
      .then((data) => !cancelled && setReceivers(data.receivers))
      .catch(() => !cancelled && setReceivers([]));
    return () => {
      cancelled = true;
    };
  }, [customer]);

  // Live price calculator — `calcDebt()`. Legacy wires this to `change` events on the exact
  // fields it reads; reproduced the same way (called from those fields' own handlers below)
  // rather than as a reactive effect, which is both truer to the original (an event-driven
  // function, not a subscription) and avoids a setState-in-effect render cascade.
  function recalcPricing(patch: {
    weight?: string;
    length?: string;
    width?: string;
    high?: string;
    service?: OnlineService;
    pexists?: boolean;
    lookupContents?: string;
    lookupValue?: string;
  }) {
    const next = {
      weight: patch.weight ?? weight,
      length: patch.length ?? length,
      width: patch.width ?? width,
      high: patch.high ?? high,
      service: patch.service ?? service,
      pexists: patch.pexists ?? pexists,
      lookupContents: patch.lookupContents ?? lookupContents,
      lookupValue: patch.lookupValue ?? lookupValue,
    };
    const result = calculateOnlineDebt({
      weight: parseFloat(next.weight),
      length: parseFloat(next.length),
      width: parseFloat(next.width),
      high: parseFloat(next.high),
      service: next.service,
      declaredPrice: tripInfo?.declaredPrice ?? 0,
      nonDeclaredPrice: tripInfo?.nonDeclaredPrice ?? 0,
      pexists: next.pexists,
      hasDeclaredContentsOrValue: next.lookupContents.trim() !== '' || next.lookupValue.trim() !== '',
    });
    // `delivery` deliberately excluded — see calculateOnlineDebt's own doc comment for why it
    // has no effect on price at all in legacy.
    setDimWeight(String(result.dimWeight));
    setDebt(String(result.debt));
  }

  function resetSharedFields() {
    setWeight('');
    setLength('');
    setWidth('');
    setHigh('');
    setDimWeight('');
    setDebt('');
    setNotes('');
    setLookupValue('');
    setLookupContents('');
    setExistingParcelId(null);
  }

  function enterCreateMode() {
    resetSharedFields();
    setMode('create');
    setService('Regular');
    setDelivery('Pickup');
    setParcelName('');
    setTrackingNum2('');
    setNotify(false);
  }

  async function handleTrackingSubmit() {
    setErrors([]);
    setSaved(null);
    setMode('idle');
    setBlockedStatus('');
    setPexists(false);

    if (!trackingNum.trim()) return;

    if (notCheck) {
      enterCreateMode();
      return;
    }

    const { parcel } = await lookupOnlineParcel(trackingNum);
    if (!parcel) {
      enterCreateMode();
      return;
    }

    setTrackingNum(parcel.trackingNum.trim());
    setTrackingNum2(parcel.trackingNum2.trim());

    if (ALLOWED_FOR_UPGRADE_UI.includes(parcel.status.toLowerCase())) {
      setPexists(true);
      setMode('update');
      setExistingParcelId(parcel.parcelId);
      setSenderLabel(parcel.longName);
      setReceiverLabel(`${parcel.receiverFirstName} ${parcel.receiverLastName}`.trim());
      setParcelName(parcel.parcelName ?? '');
      setWeight(parcel.weight ?? '');
      setLength(parcel.length ?? '');
      setWidth(parcel.width ?? '');
      setHigh(parcel.high ?? '');
      setDimWeight(parcel.dimWeight ?? '');
      setDebt(parcel.debt ?? '');
      setNotes(parcel.notes ?? '');
      setLookupValue(parcel.value ?? '');
      setLookupContents(parcel.contents ?? '');
      if (parcel.service === 'Regular' || parcel.service === 'Express' || parcel.service === 'Cargo') {
        setService(parcel.service);
      }
      // Legacy infers the delivery radio from the tracking number's own first letter
      // (`[name=sdelivery][value^=' + trackingNum.charAt(0)]`) — P/D/R matching
      // Pickup/Delivery/Region. Reproduced exactly, bizarre as it is; it has no effect on
      // price either way (see calculateOnlineDebt's doc comment).
      const firstChar = parcel.trackingNum.trim().charAt(0).toUpperCase();
      const inferredDelivery = DELIVERY_OPTIONS.find((o) => o.value.charAt(0) === firstChar);
      setDelivery((inferredDelivery?.value as Delivery) ?? 'Pickup');
      // Legacy's own `if (data.BNOTIFY == 1) {...} else {}` does nothing on false, then
      // unconditionally checks the Notify box regardless — reproduced as always-true.
      setNotify(true);
    } else {
      resetSharedFields();
      setMode('blocked');
      setBlockedStatus(parcel.status);
      if (parcel.service === 'Regular' || parcel.service === 'Express' || parcel.service === 'Cargo') {
        setService(parcel.service);
      }
    }
  }

  // Legacy's own JS reads `?trackingnum=` off the URL on load and simulates the Enter
  // keypress immediately — the entry point "Check on hold" (and others) redirect to when a
  // scanned parcel has no weight recorded yet. Only the initial (url-supplied) value
  // auto-runs, same idiom as "Send SMS"'s own url-prefilled lookup.
  useEffect(() => {
    if (trackingNum.trim()) Promise.resolve().then(() => handleTrackingSubmit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseReceiver(id: string) {
    setReceiverId(id);
    if (!id) {
      // "< New Receiver >" — legacy's `goReceiver()` empty-id branch, which blanks the city
      // field entirely (distinct from the "Tbilisi" default a *customer* change applies).
      setReceiver(emptyReceiver);
      return;
    }
    const chosen = receivers.find((r) => r.id === id);
    if (!chosen) return;
    setReceiver({
      firstName: chosen.address.firstName,
      lastName: chosen.address.lastName,
      organization: chosen.address.organization,
      city: chosen.address.city,
      state: chosen.address.state,
      street1: chosen.address.street1,
      street2: chosen.address.street2,
      phone1: chosen.address.phone1,
      phone2: chosen.address.phone2,
      phone3: chosen.address.phone3,
    });
  }

  function chooseCustomer(next: { id: string; label: string }) {
    setCustomer(next);
    setReceivers([]);
    setReceiverId('');
    // `goUser()`'s own reset — city defaults to "Tbilisi" here, unlike picking "< New
    // Receiver >" for an already-selected customer, which blanks it. Kept as the
    // inconsistency it is.
    setReceiver({ ...emptyReceiver, city: 'Tbilisi' });
  }

  function clearCustomer() {
    setCustomer(null);
    setReceivers([]);
    setReceiverId('');
    setReceiver(emptyReceiver);
  }

  const canWeightBlurSubmit = mode === 'create' && tab === 'known' && !!customer && receiverId !== '';

  async function handleWeightBlur() {
    if (weight.trim() !== '' && canWeightBlurSubmit) {
      await handleSave();
    }
  }

  function resetForNextEntry() {
    setTrackingNum('');
    setTrackingNum2('');
    setMode('idle');
    setBlockedStatus('');
    setExistingParcelId(null);
    setPexists(false);
    setSenderLabel('');
    setReceiverLabel('');
    resetSharedFields();
    setNotOnHold(false);
    setTab('known');
    setCustomer(null);
    setReceivers([]);
    setReceiverId('');
    setReceiver(emptyReceiver);
    setUnknownFirstName('');
    setUnknownLastName('');
    setLinoliFirstName('');
    setLinoliLastName('');
    setLinoliUsername('');
  }

  async function handleSave() {
    setErrors([]);

    // The pre-submit re-check — legacy's own synchronous ajax call right before
    // `.saveAndAdd`'s click actually submits, blocking on a *wider* allow-list than the one
    // that opened the edit form in the first place.
    if (trackingNum.trim()) {
      const { parcel } = await lookupOnlineParcel(trackingNum);
      if (parcel && !ALLOWED_FOR_PRESUBMIT.includes(parcel.status.toLowerCase())) {
        setErrors([`Sending with the tracking number has the status "${parcel.status}" and can not be upgraded`]);
        return;
      }
    }

    if (mode === 'create' && tab === 'known' && !customer) {
      setErrors(['You need to fill customer field']);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'update' && existingParcelId) {
        await updateOnlineParcel(existingParcelId, {
          trackingNum,
          trackingNum2,
          service,
          weight: Number(weight) || 0,
          debt: Number(debt) || 0,
          length: Number(length) || 0,
          width: Number(width) || 0,
          high: Number(high) || 0,
          dimWeight: Number(dimWeight) || 0,
          notes,
          trackingReceivedBy: user?.id ?? '',
        });
        setSaved('Parcel has been successfully updated.');
      } else {
        await createOnlineParcel({
          trackingNum,
          trackingNum2,
          service: 'Regular', // fixed — see the CREATE-mode note below
          weight: Number(weight) || 0,
          debt: Number(debt) || 0,
          length: Number(length) || 0,
          width: Number(width) || 0,
          high: Number(high) || 0,
          dimWeight: Number(dimWeight) || 0,
          notes,
          parcelName,
          notOnHold,
          trackingReceivedBy: user?.id ?? '',
          tab,
          userId: tab === 'known' ? (customer?.id ?? '') : '',
          notify: tab === 'known' ? notify : false,
          receiver: tab === 'known' ? { receiverId, ...receiver } : undefined,
          unknownFirstName: tab === 'unknown' ? unknownFirstName : '',
          unknownLastName: tab === 'unknown' ? unknownLastName : '',
          linoliFirstName: tab === 'linoli' ? linoliFirstName : '',
          linoliLastName: tab === 'linoli' ? linoliLastName : '',
          linoliUsername: tab === 'linoli' ? linoliUsername : '',
        });
        setSaved('Parcel has been successfully created.');
      }
      resetForNextEntry();
    } catch (err) {
      if (err instanceof ApiError) setErrors(extractErrorMessages(err.body));
      else setErrors(['Save failed.']);
    } finally {
      setSubmitting(false);
    }
  }

  const showFields = mode === 'update' || mode === 'create';

  return (
    <div>
      {/* This screen's own trip panel has only Ship day/Estimate per service — no AWB line,
          unlike the batch "Add Parcel" screen's `ParcelTripInfo` (which has a third "AVB:"
          line) — so it's not reused wholesale here; the fetch is the same `getTripInfo()`
          this component already needs for the price calculator below anyway. */}
      <div className={s.tripPanel}>
        <div>
          <h4>EXPRESS</h4>
          <p>Ship day: {formatTripDate(tripInfo?.express.shipDate)}</p>
          <p>Estimate: {formatTripDate(tripInfo?.express.estimateDate)}</p>
        </div>
        <div>
          <h4>REGULAR</h4>
          <p>Ship day: {formatTripDate(tripInfo?.regular.shipDate)}</p>
          <p>Estimate: {formatTripDate(tripInfo?.regular.estimateDate)}</p>
        </div>
        <div>
          <h4>CARGO</h4>
          <p>Ship day: {formatTripDate(tripInfo?.cargo.shipDate)}</p>
          <p>Estimate: {formatTripDate(tripInfo?.cargo.estimateDate)}</p>
        </div>
      </div>

      <div className={s.heading}>
        <PageHeading>Add Online Parcel</PageHeading>
        <Checkbox
          label="Do not check tracking number"
          checked={notCheck}
          onChange={(e) => toggleNotCheck(e.target.checked)}
        />
      </div>

      <ErrorList errors={errors} />
      {saved && <Alert variant="success">{saved}</Alert>}

      <div className={s.trackingRow}>
        <Field label="Tracking Number:" htmlFor="trackingnum">
          <Input
            id="trackingnum"
            value={trackingNum}
            onChange={(e) => setTrackingNum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTrackingSubmit();
              }
            }}
          />
        </Field>
      </div>

      {mode === 'blocked' && (
        <Alert variant="warning">
          Sending with the tracking number has the status &quot;{blockedStatus}&quot; and can not be upgraded
        </Alert>
      )}

      {showFields && (
        <>
          <div className={s.row}>
            {mode === 'update' && (
              <>
                <Field label="Sender:" width="lg">
                  <Input value={senderLabel} disabled />
                </Field>
                <Field label="Receiver:" width="lg">
                  <Input value={receiverLabel} disabled />
                </Field>
              </>
            )}
            <Field label="Weight:" htmlFor="weight">
              <Input
                id="weight"
                type="number"
                min={0.2}
                max={500}
                step={0.0001}
                required
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  recalcPricing({ weight: e.target.value });
                }}
                onBlur={handleWeightBlur}
              />
            </Field>
            <Field label="Amount:" htmlFor="debt">
              <Input id="debt" type="number" step={0.0001} value={debt} onChange={(e) => setDebt(e.target.value)} />
            </Field>
            <Field label="Length:" htmlFor="length">
              <Input
                id="length"
                type="number"
                step={0.0001}
                value={length}
                onChange={(e) => {
                  setLength(e.target.value);
                  recalcPricing({ length: e.target.value });
                }}
              />
            </Field>
            <Field label="Width:" htmlFor="width">
              <Input
                id="width"
                type="number"
                step={0.0001}
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value);
                  recalcPricing({ width: e.target.value });
                }}
              />
            </Field>
            <Field label="High:" htmlFor="high">
              <Input
                id="high"
                type="number"
                step={0.0001}
                value={high}
                onChange={(e) => {
                  setHigh(e.target.value);
                  recalcPricing({ high: e.target.value });
                }}
              />
            </Field>
            <Field label="Dim Weight:" htmlFor="dimweight">
              <Input id="dimweight" type="number" step={0.0001} value={dimWeight} readOnly />
            </Field>
            <Field label="Note:" htmlFor="notes">
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {mode === 'update' && (
              <Field label=" ">
                <Checkbox label="Notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              </Field>
            )}
            <Field label="Tracking Number 2:" htmlFor="trackingnum2">
              <Input id="trackingnum2" value={trackingNum2} onChange={(e) => setTrackingNum2(e.target.value)} />
            </Field>
            <Field label="Note or name a package:" htmlFor="parcelname" width="lg">
              <Input id="parcelname" value={parcelName} onChange={(e) => setParcelName(e.target.value)} />
            </Field>
          </div>

          {mode === 'create' && <Tabs ariaLabel="Shipper" options={TAB_OPTIONS} value={tab} onChange={setTab} />}

          {mode === 'create' && tab === 'known' && (
            <div className={s.row}>
              <Field label="Customer:" width="lg">
                <CustomerPicker
                  value={customer?.id ?? ''}
                  label={customer?.label ?? ''}
                  onChange={chooseCustomer}
                  onClear={clearCustomer}
                />
              </Field>

              {customer && (
                <>
                  <Field label="Receiver:" htmlFor="receiverid" width="lg">
                    <Select
                      instanceId="online-add-receiver"
                      options={[
                        { value: '', label: '< New Receiver >' },
                        ...receivers.map((r) => ({ value: r.id, label: r.label })),
                      ]}
                      value={receiverId}
                      onChange={chooseReceiver}
                    />
                  </Field>
                  <Field label="First Name:" htmlFor="receiver-firstname">
                    <Input
                      id="receiver-firstname"
                      value={receiver.firstName}
                      onChange={(e) => setReceiver({ ...receiver, firstName: e.target.value })}
                    />
                  </Field>
                  <Field label="Last Name:" htmlFor="receiver-lastname">
                    <Input
                      id="receiver-lastname"
                      value={receiver.lastName}
                      onChange={(e) => setReceiver({ ...receiver, lastName: e.target.value })}
                    />
                  </Field>
                  <Field label="City:" htmlFor="receiver-city">
                    <Input
                      id="receiver-city"
                      value={receiver.city}
                      onChange={(e) => setReceiver({ ...receiver, city: e.target.value })}
                    />
                  </Field>
                  <Field label="State:" htmlFor="receiver-state">
                    <Input
                      id="receiver-state"
                      value={receiver.state}
                      onChange={(e) => setReceiver({ ...receiver, state: e.target.value })}
                    />
                  </Field>
                  <Field label="Ubany:" htmlFor="receiver-street2">
                    <Select
                      instanceId="online-add-district"
                      options={DISTRICT_OPTIONS}
                      value={receiver.street2}
                      onChange={(value) => setReceiver({ ...receiver, street2: value })}
                    />
                  </Field>
                  <Field label="Address 1:" htmlFor="receiver-street1" width="lg">
                    <Input
                      id="receiver-street1"
                      value={receiver.street1}
                      onChange={(e) => setReceiver({ ...receiver, street1: e.target.value })}
                    />
                  </Field>
                  <Field label="Cell phone:" htmlFor="receiver-phone1">
                    <Input
                      id="receiver-phone1"
                      value={receiver.phone1}
                      onChange={(e) => setReceiver({ ...receiver, phone1: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone:" htmlFor="receiver-phone2">
                    <Input
                      id="receiver-phone2"
                      value={receiver.phone2}
                      onChange={(e) => setReceiver({ ...receiver, phone2: e.target.value })}
                    />
                  </Field>
                  <Field label="Private #:" htmlFor="receiver-phone3">
                    <Input
                      id="receiver-phone3"
                      value={receiver.phone3}
                      onChange={(e) => setReceiver({ ...receiver, phone3: e.target.value })}
                    />
                  </Field>
                  <Field label="Organization:" htmlFor="receiver-organization" width="lg">
                    <Input
                      id="receiver-organization"
                      value={receiver.organization}
                      onChange={(e) => setReceiver({ ...receiver, organization: e.target.value })}
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          {mode === 'create' && tab === 'unknown' && (
            <div className={s.row}>
              <Field label="First name:" htmlFor="unknown-firstname">
                <Input
                  id="unknown-firstname"
                  value={unknownFirstName}
                  onChange={(e) => setUnknownFirstName(e.target.value)}
                />
              </Field>
              <Field label="Last name:" htmlFor="unknown-lastname">
                <Input
                  id="unknown-lastname"
                  value={unknownLastName}
                  onChange={(e) => setUnknownLastName(e.target.value)}
                />
              </Field>
            </div>
          )}

          {mode === 'create' && tab === 'linoli' && (
            <div className={s.row}>
              <Field label="First name:" htmlFor="linoli-firstname">
                <Input
                  id="linoli-firstname"
                  value={linoliFirstName}
                  onChange={(e) => setLinoliFirstName(e.target.value)}
                />
              </Field>
              <Field label="Last name:" htmlFor="linoli-lastname">
                <Input
                  id="linoli-lastname"
                  value={linoliLastName}
                  onChange={(e) => setLinoliLastName(e.target.value)}
                />
              </Field>
              <Field label="User ID:" htmlFor="linoli-username">
                <Input
                  id="linoli-username"
                  value={linoliUsername}
                  onChange={(e) => setLinoliUsername(e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className={s.bottomPanel}>
            {/* Legacy only ever shows Service/Delivery when *updating* an existing parcel — a
                brand-new parcel created from this screen is always Regular/Pickup, with no
                control to change it (the radios are hidden entirely in create mode; see
                docs/decisions/0022-parcels-online-add.md). Delivery has no pricing effect
                either way. */}
            {mode === 'update' && (
              <>
                <Field label="Delivery:">
                  <RadioGroup
                    name="sdelivery"
                    options={DELIVERY_OPTIONS}
                    value={delivery}
                    onChange={(v) => setDelivery(v as Delivery)}
                  />
                </Field>
                <Field label="Select Service:">
                  <RadioGroup
                    name="sservice"
                    options={SERVICE_OPTIONS}
                    value={service}
                    onChange={(v) => {
                      setService(v as OnlineService);
                      recalcPricing({ service: v as OnlineService });
                    }}
                  />
                </Field>
              </>
            )}
            <div className={s.saveRow}>
              <Button type="button" disabled={submitting} onClick={handleSave}>
                {submitting ? 'Saving…' : 'Save and add another'}
              </Button>
              <Checkbox
                label="Do not place on hold"
                checked={notOnHold}
                onChange={(e) => setNotOnHold(e.target.checked)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatTripDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
}
