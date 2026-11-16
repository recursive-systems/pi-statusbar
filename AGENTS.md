# pi-statusbar

A Pi extension that draws a widget below the editor with one row per extension that registers over
the `statusbar:*` events on `pi.events`. `index.ts` is the whole extension.

- The `statusbar:*` events and their payloads are a public contract (pi-loop, pi-jobs and others
  depend on them). Change them only in a major version, and bump `v` on `statusbar:ready`.
- Other packages bundle this one as a dependency, so several copies can load in one Pi. Exactly one
  draws the bar (the `Symbol.for("pi-statusbar.owner")` global); keep that true across reloads and
  session switches.
- Pi supplies `@earendil-works/*`: keep it an optional peer dependency, never installed with the
  package.
- Keep it small. Do not add, maintain or run unit-test suites.

## Writing for people

- The README is for a person deciding in seconds whether this is worth their time.
- Keep it generic: nothing specific to any one user, company or setup.
