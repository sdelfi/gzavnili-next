"use client";

import ReactSelect, { type Props as ReactSelectProps } from "react-select";
import "./Select.css";

// Shared select. The legacy site skins every <select> via select2 (see
// docs/decisions/0002-select-library.md) — react-select is the replacement, styled here
// (Select.css) to match select2's look in public/css/style.css (border/height/colors/the
// icons.png arrow sprite) rather than react-select's default theme. `unstyled` strips
// react-select's built-in inline (emotion) styles so Select.css's plain classnames
// (via classNamePrefix) are the only source of truth for how this looks.
export type SelectOption<T extends string = string> = { value: T; label: string };

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  isSearchable = false,
  ...props
}: {
  options: SelectOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  placeholder?: string;
} & Omit<
  ReactSelectProps<SelectOption<T>, false>,
  "options" | "value" | "onChange" | "placeholder"
>) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <ReactSelect
      {...props}
      unstyled
      isSearchable={isSearchable}
      classNamePrefix="rselect"
      placeholder={placeholder}
      options={options}
      value={selected}
      onChange={(option) => onChange((option?.value ?? "") as T)}
    />
  );
}
