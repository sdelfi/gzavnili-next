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
  portal = false,
  error,
  styles: selectStyles,
  ...props
}: {
  instanceId: string;
  options: (SelectOption<T> | SelectOptionGroup<T>)[];
  value: T | '';
  onChange: (value: T) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  /** Render the options menu under document.body. Use inside dialogs so opening a long menu
   *  does not enlarge or scroll the dialog body. */
  portal?: boolean;
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
          menuPortalTarget={portal && typeof document !== 'undefined' ? document.body : undefined}
          menuPosition={portal ? 'fixed' : undefined}
          styles={
            portal
              ? {
                  ...selectStyles,
                  // react-select assigns `z-index: 1` inline to its portal wrapper; a CSS
                  // class cannot override that inline value, so the stacking fix belongs in
                  // its styles callback too.
                  menuPortal: (base) => ({ ...base, zIndex: 1100 }),
                }
              : selectStyles
          }
          classNames={
            portal
              ? {
                  menuPortal: () => s.portal,
                  menu: () => s.portalMenu,
                  menuList: () => s.portalMenuList,
                  option: ({ isFocused, isSelected }) =>
                    cn(s.portalOption, {
                      [s.portalOptionFocused]: isFocused,
                      [s.portalOptionSelected]: isSelected,
                    }),
                }
              : undefined
          }
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
