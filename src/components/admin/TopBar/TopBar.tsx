import s from './TopBar.module.css';

// Legacy bema layout (`lytBema.cfm`) always shows "You today collect: $X" in the top-right
// — the logged-in staff member's running COD-collected-today total. Recorded here as a
// real, present UI element per client request, but NOT wired to real data yet: there's no
// "collected by this staff member" concept on `Payment` in the current schema (payments
// are attributed to the customer, not the collecting agent) — see
// docs/decisions/0011-bema-admin.md. Shows "—" instead of inventing a number.
export function TopBar() {
  return (
    <div className={s.bar}>
      <span className={s.label}>You today collect:</span>
      <span className={s.value} title="Not wired yet — see docs/decisions/0011-bema-admin.md">
        —
      </span>
    </div>
  );
}
