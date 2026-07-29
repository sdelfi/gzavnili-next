import type { InputHTMLAttributes } from "react";

// Shared text/password input. style.css already styles `input[type=text]`/`input[type=password]`
// globally (border, padding, font — see public/css/style.css:139-149), so this component's job
// isn't to add styling, it's to give every form in the app one place to type/extend inputs from
// instead of each component hand-rolling its own <input>. See AGENTS.md's "shared components"
// rule — new form fields should start here, not as a bare <input>.
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
