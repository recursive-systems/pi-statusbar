# pi-statusbar

**One row per extension below your [Pi](https://pi.dev) editor, instead of everything squeezed into
the footer's single status line.**

```
 loops ●●✕●●● Reconnect Stripe in Executor
 jobs ◉✕ · 1 done, /jobs
```

Each extension that speaks the `statusbar:*` events gets its own row, in a stable order. Extensions
that don't keep using the footer as before. If pi-statusbar isn't loaded, its users fall back to the
footer on their own, so nothing breaks either way.

[pi-loop](https://github.com/recursive-systems/pi-loop) and
[pi-jobs](https://github.com/recursive-systems/pi-jobs) already bundle it: install either and you
have the bar. Only one bar is ever drawn, however many packages bring it along.

## Install

```bash
pi install git:github.com/recursive-systems/pi-statusbar@v0.1.0
```

Add `-l` to install it for one project only.

## Adding a row from your extension

Everything goes over `pi.events`, so you don't import anything:

```ts
pi.events.on("statusbar:ready", () => {
	barMode = true;                       // stop using ctx.ui.setStatus from here on
	pi.events.emit("statusbar:item", {
		id: "my-ext",                       // one row per id; emit again to replace it
		order: 30,                          // lower comes first (default 50)
		render: (theme, width) => [truncateToWidth(` my-ext ${state}`, width)],
		open: (ctx) => openMyView(ctx),     // optional: what opening the row shows
	});
});
// later: pi.events.emit("statusbar:remove", { id: "my-ext" });
```

| Event | Sent by | Payload |
| --- | --- | --- |
| `statusbar:ready` | the bar, at each session start | `{ v: 1 }` |
| `statusbar:item` | your extension | `{ id, order?, render(theme, width) => string[], open?(ctx) }` |
| `statusbar:remove` | your extension | `{ id }` |

- Listen for `statusbar:ready` before deciding where to show your status, and keep the footer
  fallback for when it never comes (print mode, or the bar isn't installed).
- `render` is called on every redraw: keep it cheap, and return each line no wider than `width`.
  Return `[]` to hide the row for now. A row that throws is skipped.
- Re-emit `statusbar:item` whenever your state changes; that triggers a redraw.
- These events are the public contract. A breaking change raises `v`.

Order so far: pi-loop `20`, pi-jobs `25`.

## Bundling it in your own package

```json
{
  "dependencies": { "pi-statusbar": "github:recursive-systems/pi-statusbar#v0.1.0" },
  "pi": { "extensions": ["./index.ts", "node_modules/pi-statusbar/index.ts"] }
}
```

MIT
