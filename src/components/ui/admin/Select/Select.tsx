'use client';

import ReactSelect, { type Props as ReactSelectProps } from 'react-select';
import cn from 'classnames';
import s from './Select.module.css';
import type { SelectOption, SelectOptionGroup } from './types';

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
  instanceId: string;
  options: (SelectOption<T> | SelectOptionGroup<T>)[];
  value: T | '';
  onChange: (value: T) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  error?: string;
} & Omit<ReactSelectProps<SelectOption<T>, false>, 'options' | 'value' | 'onChange' | 'placeholder' | 'instanceId'>) {
  const selected = flatten(options).find((option) => option.value === value) ?? null;

  return (
    <>
      <div className={cn(s.root, { [s.small]: size === 'sm' })}>
        <ReactSelect
          {...props}
          instanceId={instanceId}
          unstyled
          isSearchable={isSearchable}
          classNamePrefix="admin-select"
          placeholder={placeholder}
          options={options}
          value={selected}
          onChange={(option) => onChange((option?.value ?? '') as T)}
        />
      </div>
      {error && <span className={s.error}>{error}</span>}
    </>
  );
}
