// pi-statusbar: one row per extension below the editor, instead of every extension sharing the footer's
// single status line. Extensions talk to it over `pi.events` (see README for the contract):
//   statusbar:ready  { v: 1 }  sent here at session start: a bar exists, use it instead of setStatus
//   statusbar:item   { id, order?, render(theme, width, focus?) => string[], open?(ctx), command?(index?), count?() }
//                    adds or replaces a row
//   statusbar:remove { id }    drops a row
//
// The bar can be driven from the keyboard, like Claude Code's footer: ↓ from an empty editor moves into it,
// ↑/↓ pick a row, ←/→ pick one of the row's items (when it says it has `count()` of them), Enter opens what
// the row or item names, Esc (or ↑ past the top row, or any other key) goes back to the editor.
//
// Packages may bundle this one (pi-loop and pi-jobs do), so several copies can load in one Pi. Only the
// first to start a session draws the bar; the others stay silent, so there is never more than one bar.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

/** Where the keyboard is in a row: the row as a whole (item undefined) or one of its items. */
export type Focus = { item?: number };
type Item = {
	id: string;
	order?: number;
	render: (theme: any, width: number, focus?: Focus) => string[];
	open?: (ctx: any) => void;
	/** The slash command Enter runs, for the row (index undefined) or one of its items; runs with a command context. */
	command?: (index?: number) => string | undefined;
	/** How many items ←/→ move between (none: the row is one thing). */
	count?: () => number;
};

const OWNER = Symbol.for("pi-statusbar.owner");
const g = globalThis as any;

export default function statusbar(pi: ExtensionAPI) {
	const me = {};
	const items = new Map<string, Item>();
	let tui: any;
	let ctx: any;
	let focus: { row: string; item?: number } | undefined;
	const active = () => g[OWNER] === me;
	const redraw = () => { try { tui?.requestRender(); } catch { /* UI gone */ } };
	const sorted = () => [...items.values()].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
	const countOf = (it: Item) => { try { return Math.max(0, it.count?.() ?? 0); } catch { return 0; } };
	/** Rows that show something now: only those can take the keyboard. */
	const visible = (theme?: any) => sorted().filter(it => { try { return it.render(theme, 200).length > 0; } catch { return false; } });

	pi.events.on("statusbar:item", (item: Item) => {
		if (!active() || !item?.id || typeof item.render !== "function") return;
		items.set(item.id, item);
		redraw();
	});
	pi.events.on("statusbar:remove", (e: { id: string }) => {
		if (!active() || !items.delete(e?.id)) return;
		if (focus?.row === e.id) focus = undefined;
		redraw();
	});

	/** The editor has the keyboard, is empty, and nothing is open over it: ↓ may move into the bar. */
	function editorIdle(): boolean {
		if (!tui || tui.hasOverlay?.()) return false;
		const f = tui.getFocusedComponent?.();
		if (!f || typeof f.getText !== "function") return false;
		if (f.isShowingAutocomplete?.()) return false;
		return f.getText() === "";
	}

	function leave() { focus = undefined; redraw(); }

	function enter() {
		const it = focus && items.get(focus.row);
		const index = focus?.item;
		leave();
		if (!it) return;
		let cmd: string | undefined;
		try { cmd = it.command?.(index); } catch { /* broken row */ }
		// A slash command runs with a full command context (session switches work there), even mid-turn.
		if (cmd) { pi.sendUserMessage(cmd, { expandPromptTemplates: true }); return; }
		try { it.open?.(ctx); } catch { /* broken row */ }
	}

	function onKey(data: string): { consume: true } | undefined {
		if (!active()) return undefined;
		if (!focus) {
			if (!matchesKey(data, "down") || !editorIdle()) return undefined;
			const first = visible()[0];
			if (!first) return undefined;
			focus = { row: first.id };
			redraw();
			return { consume: true };
		}
		// Something opened over the bar or took the keyboard: give it back.
		if (tui?.hasOverlay?.()) { leave(); return undefined; }
		const rows = visible();
		const at = rows.findIndex(r => r.id === focus!.row);
		if (at < 0) { leave(); return undefined; }
		const row = rows[at]!;
		const n = countOf(row);
		if (focus.item !== undefined && focus.item >= n) focus.item = n ? n - 1 : undefined;
		if (matchesKey(data, "escape")) { leave(); return { consume: true }; }
		if (matchesKey(data, "up")) {
			if (at === 0) leave(); else { focus = { row: rows[at - 1]!.id }; redraw(); }
			return { consume: true };
		}
		if (matchesKey(data, "down")) {
			if (at < rows.length - 1) focus = { row: rows[at + 1]!.id };
			redraw(); return { consume: true };
		}
		if (matchesKey(data, "right")) {
			if (n) focus.item = focus.item === undefined ? 0 : Math.min(n - 1, focus.item + 1);
			redraw(); return { consume: true };
		}
		if (matchesKey(data, "left")) {
			if (focus.item !== undefined) focus.item = focus.item === 0 ? undefined : focus.item - 1;
			redraw(); return { consume: true };
		}
		if (matchesKey(data, "return")) { enter(); return { consume: true }; }
		// Any other key: back to the editor, and the key goes there.
		leave();
		return undefined;
	}

	pi.on("session_start", (_event, c) => {
		if (!c.hasUI) return;
		if (g[OWNER] && g[OWNER] !== me) return; // another copy draws the bar
		g[OWNER] = me;
		ctx = c;
		focus = undefined;
		c.ui.setWidget("statusbar", (t: any, theme: any) => {
			tui = t;
			return {
				render(width: number) {
					const out: string[] = [];
					for (const it of sorted()) {
						const mine = focus?.row === it.id;
						let rows: string[] = [];
						try { rows = it.render(theme, width, mine ? { item: focus!.item } : undefined); } catch { /* skip a broken row */ }
						if (mine && rows.length) {
							// The marker goes in the row's leading space (rows conventionally start with one).
							const mark = theme.fg("accent", "›");
							rows = [rows[0]!.startsWith(" ") ? mark + rows[0]!.slice(1) : truncateToWidth(mark + rows[0]!, width), ...rows.slice(1)];
						}
						out.push(...rows);
					}
					if (focus && out.length) {
						const it = items.get(focus.row);
						const n = it ? countOf(it) : 0;
						const hint = `  ↑↓ rows${n ? " · ←→ items" : ""} · Enter open · Esc back`;
						out.push(truncateToWidth(theme.fg("dim", hint), width));
					}
					return out;
				},
				invalidate() {},
			};
		}, { placement: "belowEditor" });
		c.ui.onTerminalInput?.(onKey);
		pi.events.emit("statusbar:ready", { v: 1 });
	});

	pi.on("session_shutdown", () => {
		if (active()) g[OWNER] = undefined;
		items.clear();
		tui = undefined;
		ctx = undefined;
		focus = undefined;
	});
}
