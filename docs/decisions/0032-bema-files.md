# 0032 — "Files"

## Scope: `bema/files.cfm`, not `bema/content/files.cfm`

The bema Sidebar's "Files" entry (`CONTENT` group) links to legacy `bema/files.cfm` — a
standalone, ADMINISTRATOR-gated folder/file manager (`session.buser.listGroups
('ADMINISTRATOR')` wraps the whole Content/Configuration nav section in
`views/layouts/lytBema.cfm`).

A *different* file, `bema/content/files.cfm`, has a similar name and similar-looking view
(`views/content/vwFiles.cfm`) but is not the same feature: it's a TinyMCE `file_browser_
callback` popup, only ever opened from inside a WYSIWYG editor toolbar (`file_browser_
callback: 'myFileBrowser'`, wired on `page_edit.cfm`, `include_edit.cfm`, and several
out-of-scope product/brand/category editors). It has no standalone link anywhere in legacy's
own nav — `grep`ing the whole `http/` tree for `content/files.cfm` only turns up
`file_browser_callback` wiring, never a plain `<a href>`. gzavnili-next's Site Pages editor
(`PageForm`) deliberately uses a plain `<textarea>`, not TinyMCE (see its own comment,
docs/decisions/0013-site-pages-cms.md) — so this popup has **no reachable consumer here at
all**, regardless of `content/files.cfm` being reachable in legacy. Not ported, along with its
supporting `bema/ajax/uploadFile.cfm`/`uploadSingleFile.cfm`/`uploadImage.cfm`/
`uploadPhoto.cfm`/`uploadFiles.cfm` upload endpoints (all TinyMCE-popup-only) and the product/
brand/category editors that would have opened it (all already out of scope — no products
domain in gzavnili-next).

This scoping also corrects a stale note that had been in `PROGRESS.md`: an earlier pass
speculated the statements/parcels "Invoice File" preview row (`vwParcelsUpdate.cfm`) depended
on this Files module. It doesn't — `ParcelInvoice.cfc`/`MSSQLParcelInvoiceDAO.cfc` is an
entirely separate feature (a base64/data-URL blob stored per-parcel, uploaded from the public
customer account area, not the bema admin), unrelated to `bema/files.cfm`'s on-disk folder
manager. That note is corrected in this change; the Invoice File feature itself remains
unported and untouched, tracked separately.

## No database model — matches legacy exactly

Legacy has no `files`/`folders` table at all: `model.util.files.Folder`/`File`/`Image` are
pure filesystem wrappers (`cfdirectory`, `cffile`) over `application.folders.editor`
(`<approot>/include/pages/files`). `src/lib/services/editorFiles.ts` reproduces the same shape
against `public/uploads/editor` (gitignored — admin-uploaded content, not source) rather than
adding a Prisma model for something legacy itself never persisted to a database. Production
runs on a persistent VPS via `git pull` + PM2 restart (`deploy.sh`), not an ephemeral/
serverless target, so local-disk storage is exactly as durable here as it is for legacy.

Files are served the same way legacy serves them: a plain, unauthenticated static URL
(`/uploads/editor/<folder>/<file>`, matching legacy's `../include/pages/files/<folder>/
<file>`) — no bema auth check on the file itself, only on the management screens (`GET/POST/
DELETE /api/bema/files*`), same split as legacy.

## Closed, not ported: legacy's own path-traversal gap

Legacy's folder-name sanitization (`reFindNoCase("[^A-Za-z0-9\-_]", form.folder)`) is only
ever applied on the *create-folder* branch of `bema/files.cfm`. The "does this folder exist"
GET branch that runs on every page load uses `form.folder` unsanitized in a
`directoryExists()` check and subsequent directory listing — a real path-traversal gap (a
crafted `folder=../../../whatever` would list an arbitrary directory on the server if one
existed at that relative path). `assertSafeName()` in `editorFiles.ts` validates every
folder/filename argument against the same safe charset before it ever reaches the filesystem,
on every function, closing this rather than reproducing it. This is a security fix, not a
business-logic deviation — AGENTS.md's "bugs are ported, not fixed" rule is scoped to
business/pricing logic, not to security vulnerabilities. See docs/findings.md.

## Not ported: the `/thumbs/` write in the upload handler

Legacy's upload handler always writes a second, resized (max 100×75) copy of every uploaded
image into a `thumbs/` subfolder (`Image.save(destination = .../thumbs/..., keepCopy = true)`).
Nothing in `vwFiles.cfm` (this screen's own view) ever reads from that subfolder — only the
*other*, unreachable `content/vwFiles.cfm` (the TinyMCE popup, see above) does. It's a
write-only side effect with zero observable effect from within this screen. Not reproduced —
see docs/findings.md.

## Resize semantics

Legacy's optional "Resize image to WxH" checkbox calls `ImageResize(img, width, height)`,
whose documented behavior is: both dimensions given stretches to that exact size (no aspect-
ratio preservation); only one given scales proportionally from that one. `editorFiles.ts`'s
`saveUploadedFile()` reproduces the same width/height semantics with `sharp` (`fit: 'fill'`
when both are given; `sharp`'s own proportional default when only one is). Pixel-for-pixel
identical output across completely different image libraries isn't the goal (same precedent
as `docs/decisions/0029-parcels-barcode-print.md`'s barcode rendering) — matching the
documented width/height contract is.

## What wasn't ported, and why

- **The TinyMCE file-browser popup** (`bema/content/files.cfm` + its dedicated upload
  endpoints) — no reachable consumer, see above.
- **Sort by anything other than filename.** Legacy's own `form.sort` is validated against
  `listFind("Filename", form.sort)` — filename is the *only* value that ever passes, so it's
  the only sortable column here too (direction is still user-controlled).
- **The `/thumbs/` copy** — write-only dead code, see above.
