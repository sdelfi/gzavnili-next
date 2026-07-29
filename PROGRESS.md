# Progress Log

Running record of what's been done in this project, checked off against the phases in
`../docs/06-phased-rollout-plan.md` (the parent legacy repo's migration plan). Newest entries
at the top. This is a changelog, not a plan — see that file for scope/sequencing.

## Phase 2 — Public static site (SSG) — in progress

- [x] Bootstrapped Next.js (App Router, TypeScript, bun, no Tailwind) — `240cbbe`, `4fd2c26`, `3d618c4`
- [x] Ported legacy homepage markup/CSS as-is (Header, Footer, homepage sections) from
      `../http/views/layouts/new.html` and `../http/views/home.html`, English branch only —
      same classes, so `../http/css/style.css` etc. apply unchanged — `4fd2c26`
- [x] Reimplemented every interactive behavior `main.js`/jQuery used to provide, as plain
      React components (no jQuery, no plugin scripts loaded): header dropdowns + office
      open-now indicator, tracking/login popovers (`Modal.tsx`), home slider (`HomeSlider.tsx`),
      FAQ accordion (`FaqAccordion.tsx`) — `240cbbe`
- [x] Local dev infra: `docker-compose.yml` (Postgres), `.env.example`
- [ ] Georgian-language branch of Header/Footer/homepage (currently English-only)
- [ ] Remaining public/marketing pages (services, cargo, courier, pricing, FAQ, legal/customs, news)
- [ ] Public unauthenticated tracking page wired to real Postgres data (Phase 1 schema/backend
      not built yet — this page is currently just a UI shell/modal)

## Not started

- Phase 0 (audit), Phase 1 (Postgres schema/backend), Phase 3 (authorized zone), Phase 4 (bema
  admin), Phase 5 (mobile API), Phase 6 (cron), Phase 7 (cutover) — see the rollout plan.
