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

## Drive it from the keyboard

Like Claude Code's footer: with the editor empty, press **↓** to move into the bar. **↑/↓** pick a
row, **←/→** pick one item in it (a loop, a job), **Enter** opens it, and **Esc** goes back to the
editor (so does ↑ past the top row, or just starting to type).

## Install

```bash
pi install git:github.com/recursive-systems/pi-statusbar@v0.2.0
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
		render: (theme, width, focus) => [truncateToWidth(` my-ext ${state}`, width)],
		open: (ctx) => openMyView(ctx),     // optional: what opening the row shows
		// optional: items ←/→ move between, and the slash command Enter runs (row: i undefined)
		count: () => things.length,
		command: (i) => (i === undefined ? "/my-ext" : `/my-ext ${things[i].id}`),
	});
});
// later: pi.events.emit("statusbar:remove", { id: "my-ext" });
```

| Event | Sent by | Payload |
| --- | --- | --- |
| `statusbar:ready` | the bar, at each session start | `{ v: 1 }` |
| `statusbar:item` | your extension | `{ id, order?, render(theme, width, focus?) => string[], open?(ctx), count?(), command?(i?) }` |
| `statusbar:remove` | your extension | `{ id }` |

- Listen for `statusbar:ready` before deciding where to show your status, and keep the footer
  fallback for when it never comes (print mode, or the bar isn't installed).
- `render` is called on every redraw: keep it cheap, and return each line no wider than `width`.
  Return `[]` to hide the row for now. A row that throws is skipped.
- `focus` is set while the keyboard is on your row: `{ item }` is the index ←/→ picked (undefined for
  the row as a whole). Show the picked item however suits your row; the bar adds the `›` marker.
- `command` beats `open`: a slash command runs with a full command context, so it can switch
  sessions or wait for the agent, which `open` (called from a key handler) can't.
- Re-emit `statusbar:item` whenever your state changes; that triggers a redraw.
- These events are the public contract. A breaking change raises `v`.

Order so far: pi-loop `20`, pi-jobs `25`.

## Bundling it in your own package

```json
{
  "dependencies": { "pi-statusbar": "github:recursive-systems/pi-statusbar#v0.2.0" },
  "pi": { "extensions": ["./index.ts", "node_modules/pi-statusbar/index.ts"] }
}
```

MIT
