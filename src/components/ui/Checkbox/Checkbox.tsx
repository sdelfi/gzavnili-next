'use client';

import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import s from './Checkbox.module.css';

// Shared checkbox, with the one thing a bare `<input type="checkbox">` can't express in JSX:
// the indeterminate state, which is a DOM property rather than an attribute. The parcels
// list's per-shipment "select all" header box needs it (some rows selected, not all) — the
// legacy screen simply had no such state and left the box looking unchecked.
export function Checkbox({
  label,
  indeterminate = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const input = <input ref={ref} type="checkbox" className={s.input} {...props} />;
  if (!label) return input;

  return (
    <label className={s.wrapper}>
      {input}
      <span className={s.label}>{label}</span>
    </label>
  );
}
