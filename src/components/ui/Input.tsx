import type { InputHTMLAttributes } from "react";

// Shared text/password input. style.css already styles `input[type=text]`/`input[type=password]`
// globally (border, padding, font — see public/css/style.css:139-149), so this component's job
// isn't to add styling, it's to give every form in the app one place to type/extend inputs from
// instead of each component hand-rolling its own <input>. See AGENTS.md's "shared components"
// rule — new form fields should start here, not as a bare <input>.
//
// `error`: the legacy site validates with jquery.validate (see e.g.
// `../http/views/homecals.cfm`'s `jQuery('.pricecalc_form').validate();`), which renders a
// `<label class="error">` right after the field — not a native HTML5 validation bubble. `error`
// reproduces that same markup/class (`.error { color: red !important }` in
// public/css/style_custom.css) instead of relying on `required`/`:invalid`.
export function Input({
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <>
      <input {...props} />
      {error && <label className="error">{error}</label>}
    </>
  );
}
