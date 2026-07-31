import { forwardRef, type InputHTMLAttributes } from 'react';
import './Input.css';

// Shared text/password input — `Input.css` (moved out of public/css/style.css, see that
// file's own styling job) covers `input[type=text]`/`input[type=password]` etc. globally
// (border, padding, font), so this component's own job isn't to add styling, it's to give
// every form in the app one place to type/extend inputs from instead of each component
// hand-rolling its own <input>. See AGENTS.md's "shared components" rule — new form fields
// should start here, not as a bare <input>.
//
// `error`: the legacy site validates with jquery.validate (see e.g.
// `../http/views/homecals.cfm`'s `jQuery('.pricecalc_form').validate();`), which renders a
// `<label class="error">` right after the field — not a native HTML5 validation bubble. `error`
// reproduces that same markup/class (`.error { color: red !important }` in
// public/css/style_custom.css) instead of relying on `required`/`:invalid`.
//
// Forwards its ref to the underlying `<input>` — the parcel form's Tracking # field needs it
// to focus+select on mount, the one legacy behaviour that can't be done any other way.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  function Input({ error, type = 'text', ...props }, ref) {
    return (
      <>
        <input ref={ref} type={type} {...props} />
        {error && <label className="error">{error}</label>}
      </>
    );
  },
);
