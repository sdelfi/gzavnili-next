'use client';

import ReactSelect, { type Props as ReactSelectProps } from 'react-select';
import './Select.css';

// Shared select. The legacy site skins every <select> via select2 (see
// docs/decisions/0002-select-library.md) — react-select is the replacement, styled here
// (Select.css) to match select2's look in public/css/style.css (border/height/colors/the
// icons.png arrow sprite) rather than react-select's default theme. `unstyled` strips
// react-select's built-in inline (emotion) styles so Select.css's plain classnames
// (via classNamePrefix) are the only source of truth for how this looks.
export type SelectOption<T extends string = string> = { value: T; label: string };
/** react-select renders a `{ label, options }` entry as an option group — used by the bema
 *  parcels list's Service/Type filter, which legacy faked with unselectable `--Service--`
 *  separator rows inside one flat list. */
export type SelectOptionGroup<T extends string = string> = { label: string; options: SelectOption<T>[] };

const flatten = <T extends string>(options: (SelectOption<T> | SelectOptionGroup<T>)[]): SelectOption<T>[] =>
  options.flatMap((option) => ('options' in option ? option.options : [option]));

export function Select<T extends string = string>({
  instanceId,
  options,
  value,
  onChange,
  placeholder,
  isSearchable = false,
  size = 'md',
  error,
  ...props
}: {
  // Required, not optional: react-select falls back to a module-level render counter for its
  // internal DOM ids when this is omitted, which is stable neither across server renders (the
  // counter persists for the life of the Node process, across requests) nor between server and
  // client (the client always restarts it at 0) — a guaranteed hydration mismatch on any page
  // with more than one Select, or any server that's handled more than one request. Pass
  // something stable and unique per field (its name/id is usually right there already).
  instanceId: string;
  options: (SelectOption<T> | SelectOptionGroup<T>)[];
  value: T | '';
  onChange: (value: T) => void;
  placeholder?: string;
  /** `sm` is the compact control the bema admin screens use (legacy Bootstrap's
   *  `form-group-xs`); `md` is the public site's full-height field. */
  size?: 'sm' | 'md';
  // Same convention as ui/Input.tsx's `error` — a jquery.validate-style `<label class="error">`
  // rendered right after the field, not a native browser validation bubble.
  error?: string;
} & Omit<ReactSelectProps<SelectOption<T>, false>, 'options' | 'value' | 'onChange' | 'placeholder' | 'instanceId'>) {
  const selected = flatten(options).find((option) => option.value === value) ?? null;

  return (
    <>
      <ReactSelect
        {...props}
        instanceId={instanceId}
        unstyled
        isSearchable={isSearchable}
        className={size === 'sm' ? 'rselect-sm' : undefined}
        classNamePrefix="rselect"
        placeholder={placeholder}
        options={options}
        value={selected}
        onChange={(option) => onChange((option?.value ?? '') as T)}
      />
      {error && <label className="error">{error}</label>}
    </>
  );
}
