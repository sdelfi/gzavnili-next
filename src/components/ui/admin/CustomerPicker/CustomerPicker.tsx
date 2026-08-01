'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { listUsers } from '@/lib/api/bema/users';
import s from './CustomerPicker.module.css';

// "Search For Customer" — legacy's jQuery-autocomplete box over `bema/ajax/users.cfm`, which
// writes the chosen id into a hidden `userid` field and its label into a `<span>`. Same
// shape here: type to search, pick a row, and the selection is what the caller acts on.
// Shared across the parcel-add form, the receiver form, and the global Pricing Rules
// Administration filter bar — promoted here (rather than left under
// `admin/parcels/`) once it hit a second/third caller, per this repo's shared-components
// rule.

type CustomerRow = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

export const customerLabel = (row: CustomerRow) => `${row.lastName ?? ''}, ${row.firstName ?? ''} / ${row.username}`;

export function CustomerPicker({
  value,
  label,
  onChange,
  onClear,
  error,
}: {
  value: string;
  /** Label of the currently-selected customer, shown until a new one is picked. */
  label: string;
  onChange: (customer: { id: string; label: string }) => void;
  /** When provided, shows a "Clear" affordance next to the selection (for optional filter-bar
   *  usage) rather than the "must pick one" form-field usage. */
  onClear?: () => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  // Results are stored with the query that produced them and only shown while that query is
  // still what's in the box — so an in-flight response can't briefly show suggestions for a
  // string the operator has already changed.
  const [loaded, setLoaded] = useState<{ query: string; rows: CustomerRow[] }>({ query: '', rows: [] });
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const results = loaded.query === trimmed ? loaded.rows : [];
  const open = !dismissed && results.length > 0;

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listUsers<CustomerRow>({
        accountType: 'Customer',
        page: 1,
        perPage: 20,
        sort: 'lastName',
        dir: 'asc',
        search: trimmed,
      })
        .then((data) => !cancelled && setLoaded({ query: trimmed, rows: data.items }))
        .catch(() => {
          // A failed lookup just means no suggestions; the field keeps its current value.
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Clicking anywhere else dismisses the suggestions without changing the selection.
  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setDismissed(true);
    }
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  return (
    <div className={s.picker} ref={containerRef}>
      <Input
        type="text"
        value={query}
        placeholder="Search by name, username or email…"
        onChange={(e) => {
          setQuery(e.target.value);
          setDismissed(false);
        }}
        onFocus={() => setDismissed(false)}
      />

      {open && results.length > 0 && (
        <ul className={s.results}>
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={s.result}
                onClick={() => {
                  onChange({ id: row.id, label: customerLabel(row) });
                  setQuery('');
                  setDismissed(true);
                }}
              >
                {customerLabel(row)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={s.selected}>
        » {value ? label : <i>Not selected</i>}
        {onClear && value && (
          <button type="button" className={s.clear} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {error && <label className="error">{error}</label>}
    </div>
  );
}
