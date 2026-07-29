// Slash-command templates for the chat input. Selecting one prefills the input
// with the plugin name (add) or the target tile (patch) and its argument keys,
// so the user only fills in the values. The deterministic backend resolver maps
// the name to the right plugin, and its disambiguation flow handles any tile
// tie the `where` anchor doesn't break.

export const SLASH_TRIGGER = "/";

// Read-only actions that are safe to prefill as a whole prompt.
const STATIC_ITEMS = [
  {
    key: "list",
    group: "Ask",
    title: "List available plugins",
    subtitle: "See everything you can add",
    insert: "What plugins are available?",
  },
];

function parseArgs(argsString) {
  try {
    const parsed = JSON.parse(argsString || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

// One "/add" entry per installed plugin. Template carries the arg keys with
// empty values for the user to fill.
export function buildAddItems(catalog) {
  return (catalog || [])
    .filter((p) => p && p.source)
    .map((p) => {
      const args = p.args || [];
      const argPart = args.length
        ? ` with ${args.map((a) => `${a} = `).join(", ")}`
        : "";
      const name = p.label || p.source;
      return {
        key: `add:${p.source}`,
        group: "Add a plugin",
        title: name,
        subtitle: args.length ? args.join(", ") : "no arguments",
        insert: `Add ${name}${argPart}`,
      };
    });
}

// One "/patch" entry per (existing tile, editable arg). The template pins the
// tile via a current value (`where`) and blanks only the new value.
export function buildPatchItems(tiles) {
  const items = [];
  for (const tile of tiles || []) {
    const source = tile?.source;
    if (!source) continue;
    const args = parseArgs(tile.args_string);
    const names = Object.keys(args);
    if (!names.length) continue;

    // Anchor the tile on its first non-empty current value so `where` can
    // disambiguate same-source tiles.
    const anchorName =
      names.find((n) => String(args[n] ?? "").trim() !== "") || names[0];
    const anchorVal = args[anchorName];
    const where =
      String(anchorVal ?? "").trim() !== ""
        ? ` where ${anchorName} is ${anchorVal}`
        : "";

    for (const name of names) {
      items.push({
        key: `patch:${source}:${name}:${tile.uuid || tile.i || anchorVal}`,
        group: "Change a tile",
        title: source,
        subtitle: `${name} (now ${args[name]})`,
        insert: `Change ${source}${where} to ${name} = `,
      });
    }
  }
  return items;
}

export function buildSlashItems({ catalog, tiles }) {
  return [...STATIC_ITEMS, ...buildAddItems(catalog), ...buildPatchItems(tiles)];
}

// Substring-of-every-token filter over the visible fields. Deterministic:
// preserves the source order (Ask, Add, Change).
export function filterSlashItems(items, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return items;
  const tokens = q.split(/\s+/);
  return items.filter((item) => {
    const hay =
      `${item.group} ${item.title} ${item.subtitle} ${item.insert}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}

// Place the cursor right after the first "= " so the user types the first
// value immediately; fall back to the end when there's nothing to fill.
export function caretForInsert(text) {
  const i = text.indexOf("= ");
  return i === -1 ? text.length : i + 2;
}
