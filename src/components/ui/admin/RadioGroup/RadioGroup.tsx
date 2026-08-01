import s from './RadioGroup.module.css';

// A row of mutually-exclusive radio buttons. Promoted to `ui/` (per AGENTS.md's "shared
// components" rule) for the batch "Add Parcel" screen's Delivery/Service choices — legacy
// renders both as `<input type="radio">` groups rather than `<select>`s (see
// `views/parcels/vwParcelsAdd.cfm`'s "addParcel" modal), the one place on the parcels screens
// that does.

export function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={s.group} role="radiogroup">
      {options.map((option) => (
        <label key={option.value} className={s.option}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
