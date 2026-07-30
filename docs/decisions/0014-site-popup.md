# 0014 — Site-wide announcement popup (bema "Site Settings" → "Popup")

## Investigation

Client reported a blank/empty popup appearing on the legacy site (`class="message-popup"`)
and asked what drives it, plus flagged a suspected bug: an empty message still shows.

**Mechanism** (`views/layouts/new.html`): every page fetches the singleton `config` row
(`extensions/components/util/Config.cfc` / `MSSQLConfigDAO.cfc`, blind `SELECT * FROM config`
/ `UPDATE config SET ...` with no `WHERE`, since there's only ever one row) and, if
`ePopup = 1` and the `showpopup` cookie isn't already set, shows a `.message-popup` div via
the `fancybox` jQuery plugin containing `PopupMessageen` or `PopupMessagege` depending on
locale. Closing it sets `showpopup` for 2 hours (`DateAdd("h", 2, now())`).

This is a **different** mechanism from `.message-popup2`, an unrelated per-user inbox/
notification popup — not in scope here.

**Confirmed bug**: legacy shows the popup purely on `ePopup = 1`, with no
`len(trim(popupMessage))` check. An admin can enable the flag with the message field left
blank and every visitor gets an empty popup with nothing but a close button — exactly what
the client's screenshot showed. Fixed in this port by additionally requiring a non-empty,
trimmed message for the visitor's locale before rendering anything
(`src/components/SitePopup/SitePopup.tsx`).

## Implementation

- `prisma/schema.prisma`'s pre-existing (previously unused) `Config` singleton model gained
  `popupEnabled`/`popupMessageEn`/`popupMessageGe`, mapped from legacy's `ePopup`/
  `PopupMessageen`/`PopupMessagege`.
- `src/components/SitePopup/` — server component (`SitePopup.tsx`) does the enabled+non-empty
  check server-side; `SitePopupClient.tsx` handles the `showpopup` cookie (same name/2h expiry
  as legacy) and renders the existing `Modal` component (the project's featherlight-style
  modal, already used elsewhere) instead of pulling in fancybox. Rendered once from
  `src/app/[locale]/layout.tsx`.
- bema admin: `/bema/settings` (`SiteSettingsForm`) lets an admin toggle the popup and edit
  both locale messages, backed by `GET`/`PATCH /api/bema/config`.

## Scope

Only the popup fields of legacy's `settings.cfm` mega-form are built. The rest of that
screen — Consignee/Header Site Message (confirmed dead/unused legacy fields), Airway Bill/
Date, Regular/Express/Cargo Services shipping dates+AWB, Lari Rate, declared/non-declared
parcel pricing — belongs to the not-yet-built parcels domain and is deliberately deferred,
not silently dropped.
