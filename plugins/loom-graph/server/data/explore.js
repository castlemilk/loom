// src/explore.ts
var normalize = (s) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function createGraphIndex(data) {
  const entries = /* @__PURE__ */ new Map();
  for (const node of data.nodes) {
    if (entries.has(node.id)) throw new RangeError("Duplicate node: " + node.id);
    entries.set(node.id, { node, incoming: [], outgoing: [] });
  }
  function entry(id) {
    const item = entries.get(id);
    if (!item) throw new RangeError("Unknown node: " + id);
    return item;
  }
  for (const link of data.links) {
    entry(link.source).outgoing.push(link);
    entry(link.target).incoming.push(link);
  }
  let searchable;
  function search(query, { within, limit = data.nodes.length } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError("Expected a nonnegative search limit");
    const term = normalize(query);
    if (!term || !limit) return [];
    searchable ??= data.nodes.map((node) => {
      const label = normalize(node.label ?? ""), id = normalize(node.id);
      return { node, label, id, text: [label, id, normalize([node.section, node.kind, node.summary].join(" "))].join(" ") };
    });
    const words = term.split(" "), ranked = [[], [], [], []];
    for (const { node, label, id, text } of searchable) {
      if (within && !within.has(node.id)) continue;
      if (label === term || id === term) ranked[0].push(node);
      else if (label.startsWith(term) || id.startsWith(term)) ranked[1].push(node);
      else if (label.includes(term) || id.includes(term)) ranked[2].push(node);
      else if (words.every((word) => text.includes(word))) ranked[3].push(node);
    }
    return ranked.flat().slice(0, limit);
  }
  function neighbors(id, direction) {
    if (direction !== "incoming" && direction !== "outgoing") throw new RangeError("Expected incoming or outgoing");
    const grouped = /* @__PURE__ */ new Map();
    for (const link of entry(id)[direction]) {
      const other = direction === "incoming" ? link.source : link.target;
      const links = grouped.get(other);
      if (links) links.push(link);
      else grouped.set(other, [link]);
    }
    return Array.from(grouped, ([other, links]) => ({ node: entry(other).node, links }));
  }
  function boundary(members) {
    const ids = new Set(members), outside = /* @__PURE__ */ new Map();
    function count(id, direction) {
      if (ids.has(id)) return;
      let row = outside.get(id);
      if (!row) {
        row = { node: entry(id).node, incoming: 0, outgoing: 0 };
        outside.set(id, row);
      }
      row[direction]++;
    }
    for (const id of ids) {
      const item = entry(id);
      for (const edge of item.incoming) count(edge.source, "incoming");
      for (const edge of item.outgoing) count(edge.target, "outgoing");
    }
    return [...outside.values()].sort((a, b) => b.incoming + b.outgoing - (a.incoming + a.outgoing));
  }
  return { search, neighbors, boundary };
}
export {
  createGraphIndex
};
