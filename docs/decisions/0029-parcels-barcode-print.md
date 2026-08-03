# 0029 — Parcel barcode/QR + "View Parcel" + "Print Labels" + "Scan"

## Scope

Ports three legacy popup screens that share one underlying capability — server-generated
barcode/QR images — plus the image generation itself:

- `bema/parcels/parcels-view.cfm` + `views/parcels/vwParcelsView.cfm` ("View Parcel") — a
  printable single-parcel detail page: trip/service/tracking with its barcode, weight/value/
  paid-or-debt, sender/receiver, contents, and the parcel's edit-history log.
- `bema/parcels/parcels-print.cfm` + `views/parcels/vwParcelsPrint.cfm` ("Print Labels") —
  one shipping label per parcel id (`?parcels=id1,id2,...`), auto-printed via `window.print()`.
- `bema/parcels/parcels-scan.cfm` + `views/parcels/vwParcelsScan.cfm` ("Scan") — a bare
  barcode-image popup for eyeballing or physically scanning a code (a parcel's `pcode`, or a
  tracking number) off the screen.

All three are opened from the parcels list (`bema/views/parcels/vwParcels.cfm`) via
`window.open(..., 'width=640,height=480,scrollbars=yes')` (View is a plain link; Print/Scan
are popups) — reproduced the same way from `ParcelRowActions` (per-row View/Print/Scan) and
`ParcelGroupCard` (the shipment header's "Code — {pcode}" link).

## Barcode/QR generation: one JS library instead of two Java ones

Legacy generates images server-side via `extensions/components/barcodes/barcode/barcode.cfc`
(Java Barbecue, `createCode128` — the only one of its ~25 supported symbologies any caller
ever requests) and `barcodeQR/barcodeQR.cfc` (Java ZXing's `QRCodeWriter`), then streams the
result inline via `<cfimage action="writeToBrowser">`. Reproduced as `bwip-js` (`bwip-js/node`
subpath import — its top-level export uses named conditions `browser`/`node`/`electron` that
TypeScript's `bundler` module resolution doesn't select automatically) in
`src/lib/services/parcelBarcode.ts`, generating PNG buffers for both symbologies from one
dependency instead of two.

A Next.js page can't stream a raw image inline the way a `.cfm` response could, so the
barcode/QR became their own `<img src>` targets: `GET /api/bema/parcels/barcode?text=&height=`
and `GET /api/bema/parcels/qrcode?text=&width=`, gated the union of what View/Print/Scan's own
page-level gates allow (`BemaAdministrator`/`BemaAgent`).

**Not pixel-identical, and not meant to be**: Barbecue/ZXing and bwip-js are unrelated
rendering engines: matching output byte-for-byte isn't achievable or meaningful across them.
What legacy fidelity means here is the same symbology encoding the same text at a comparable
size — verified by scanning/decoding, not by diffing pixels.

## "View Parcel"'s delivery-confirmation section — not ported, no schema for it

**Found:** `vwParcelsView.cfm` has a second section below the barcode/history — a signature
image, a photo, a photo-id image, GPS lat/lon, and free-text comments, all read from
`parcels.Signature`/`Picture`/`PhotoId`/`Lat`/`Lon`/`AComment`/`GlobalComment`/`PrivateNumber`
(or a `D:\WebsitesDev\gzavnili_images\...` file path fallback via `apinew/viewimage.cfm`) —
evidently a mobile-app delivery-confirmation capture flow. None of these columns exist in this
schema; `docs/migrations/00-overview.md`'s Phase 5 (mobile API) is explicitly not started yet.

**Open — needs a decision once Phase 5 is scoped**: not ported. `ParcelViewPage` renders
everything else on the page (trip/service/barcode/weight/value/sender/receiver/contents/
history) and stops there.

## What wasn't ported, and why

- **Legacy's own commented-out fallback print layout** — `vwParcelsPrint.cfm` has a large
  `<!--- ... --->` block with a two-office-address footer and a plainer receiver-only layout.
  Already dead in the source; not reproduced.
- **The QR code's gate is on `Contents`, but it encodes `TrackingNum`** — `vwParcelsPrint.cfm`
  gates the QR render on `parcel.getContents() neq ""` but the QR itself always encodes
  `parcel.gettrackingnum()`, never the contents. Reproduced exactly as this apparent
  mismatch: `ParcelPrintPage`'s QR `<img>` is gated on `parcel.contents` truthy, encoding
  `parcel.trackingNum`. See `docs/findings.md`.
- **`vwParcelsView.cfm`'s own QR-code block is commented out** (`<!--- ... --->` around the
  `barcodeQR` call under "Parcel Contents") — dead in the source; `ParcelViewPage` has no QR
  code at all, matching what actually renders in legacy.

See `docs/findings.md` for the two items above, plus the delivery-office-letter API field
addition and the per-row "Scan" action, which had no route of its own in this app before now.
