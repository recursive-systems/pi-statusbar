// pi-statusbar: one row per extension below the editor, instead of every extension sharing the footer's
// single status line. Extensions talk to it over `pi.events` (see README for the contract):
//   statusbar:ready  { v: 1 }  sent here at session start: a bar exists, use it instead of setStatus
//   statusbar:item   { id, order?, render(theme, width) => string[], open?(ctx) }  adds or replaces a row
//   statusbar:remove { id }    drops a row
//
// Packages may bundle this one (pi-loop and pi-jobs do), so several copies can load in one Pi. Only the
// first to start a session draws the bar; the others stay silent, so there is never more than one bar.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Item = { id: string; order?: number; render: (theme: any, width: number) => string[]; open?: (ctx: any) => void };

const OWNER = Symbol.for("pi-statusbar.owner");
const g = globalThis as any;

export default function statusbar(pi: ExtensionAPI) {
	const me = {};
	const items = new Map<string, Item>();
	let tui: any;
	const active = () => g[OWNER] === me;
	const redraw = () => { try { tui?.requestRender(); } catch { /* UI gone */ } };

	pi.events.on("statusbar:item", (item: Item) => {
		if (!active() || !item?.id || typeof item.render !== "function") return;
		items.set(item.id, item);
		redraw();
	});
	pi.events.on("statusbar:remove", (e: { id: string }) => {
		if (active() && items.delete(e?.id)) redraw();
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		if (g[OWNER] && g[OWNER] !== me) return; // another copy draws the bar
		g[OWNER] = me;
		ctx.ui.setWidget("statusbar", (t: any, theme: any) => {
			tui = t;
			return {
				render(width: number) {
					const rows: string[] = [];
					for (const it of [...items.values()].sort((a, b) => (a.order ?? 50) - (b.order ?? 50))) {
						try { rows.push(...it.render(theme, width)); } catch { /* skip a broken row */ }
					}
					return rows;
				},
				invalidate() {},
			};
		}, { placement: "belowEditor" });
		pi.events.emit("statusbar:ready", { v: 1 });
	});

	pi.on("session_shutdown", () => {
		if (active()) g[OWNER] = undefined;
		items.clear();
		tui = undefined;
	});
}
