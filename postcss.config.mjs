// ─── iOS 12 / Safari 12 compatibility plugins ──────────────────────────────
//
// 1. stripCascadeLayers
//    Safari 12 treats unknown @-rule blocks as errors and silently drops their
//    entire content. Tailwind v4 wraps all generated CSS in @layer theme / base
//    / utilities — every Tailwind class would be invisible. This plugin hoists
//    @layer block contents to the parent scope, preserving declaration order so
//    cascade priority is unchanged. No :where() or other modern CSS introduced.
//
// 2. stripSingleArgWhere
//    Tailwind v4 uses :where(.class>...) for space-y-* and divide-* utilities,
//    and abbr:where([title]) / input:where([type=...]) in base styles. Safari 12
//    drops any rule containing an unknown pseudo-class. For single-argument
//    :where(X), replacing with X is safe — specificity rises slightly but there
//    are no competing rules in this codebase that would break. Multi-argument
//    :where(A, B) is left as-is to avoid selector-list expansion complexity.
// ───────────────────────────────────────────────────────────────────────────

function stripCascadeLayers() {
  return {
    postcssPlugin: "strip-cascade-layers",
    AtRule: {
      layer(node) {
        if (node.nodes?.length) {
          node.replaceWith(node.nodes);
        } else {
          node.remove();
        }
      },
    },
  };
}
stripCascadeLayers.postcss = true;

function unwrapWhere(selector) {
  let out = "";
  let i = 0;
  while (i < selector.length) {
    const wi = selector.indexOf(":where(", i);
    if (wi === -1) { out += selector.slice(i); break; }
    out += selector.slice(i, wi);
    // Walk forward to find the matching closing paren (handles nested parens).
    let depth = 1;
    let j = wi + 7;
    while (j < selector.length && depth > 0) {
      if (selector[j] === "(") depth++;
      else if (selector[j] === ")") depth--;
      if (depth > 0) j++;
    }
    const inner = selector.slice(wi + 7, j);
    // Only unwrap if there are no top-level commas (single argument).
    let d = 0;
    let hasTopComma = false;
    for (const ch of inner) {
      if (ch === "(") d++;
      else if (ch === ")") d--;
      else if (ch === "," && d === 0) { hasTopComma = true; break; }
    }
    out += hasTopComma ? selector.slice(wi, j + 1) : inner;
    i = j + 1;
  }
  return out;
}

function stripSingleArgWhere() {
  return {
    postcssPlugin: "strip-single-arg-where",
    Rule(rule) {
      if (rule.selector.includes(":where(")) {
        rule.selectors = rule.selectors.map(unwrapWhere);
      }
    },
  };
}
stripSingleArgWhere.postcss = true;

export default {
  plugins: ["@tailwindcss/postcss", stripCascadeLayers, stripSingleArgWhere],
};
