<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Commit message rules

Do not add a `Co-Authored-By:` trailer (or any AI-attribution trailer) to commit
messages in this repo.

# Shared components

Reusable UI primitives (inputs, selects, buttons, and the like) belong in
`src/components/ui/`, not hand-rolled inline in whichever page/component
needs them first. Before writing a new `<input>`/`<select>`/etc., check
`src/components/ui/` for one that already fits, and extend it rather than
duplicating markup. If a pattern shows up in a second place, promote it to
`src/components/ui/` as part of that change.

# Routing

Every internal `href`/`action` goes through `src/lib/routes.ts`'s `routes`
helper (`routes.home()`, `routes.login()`, `routes.page("slug")` for a
static marketing page, etc.) instead of a literal path string. Add a new
named helper there when a route doesn't have one yet.

# Progress log

After any implementation work in this repo (features, fixes, refactors — not
one-off investigation), update `PROGRESS.md`: check off the step(s) completed,
and add new unchecked items for anything the work revealed as still
outstanding. Keep entries terse and reference the commit hash. Do this as part
of the same change, not as a separate follow-up.
