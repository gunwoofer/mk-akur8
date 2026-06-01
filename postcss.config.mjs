// ─── iOS 12 / Safari 12 compatibility plugins ──────────────────────────────
//
// 1. stripCascadeLayers — hoists @layer block contents to parent scope.
//    Safari 12 drops the entire content of unknown @-rule blocks.
//
// 2. stripSingleArgWhere — unwraps :where(X) → X for single-argument cases.
//    Safari 12 drops rules whose selectors contain unknown pseudo-classes.
//
// 3. expandInset — expands `inset: value` to individual top/right/bottom/left.
//    The CSS `inset` shorthand requires Safari 14.1; Safari 12 ignores it,
//    causing fixed/absolute overlays to collapse to zero size.
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
    let depth = 1;
    let j = wi + 7;
    while (j < selector.length && depth > 0) {
      if (selector[j] === "(") depth++;
      else if (selector[j] === ")") depth--;
      if (depth > 0) j++;
    }
    const inner = selector.slice(wi + 7, j);
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

function expandInset() {
  return {
    postcssPlugin: "expand-inset",
    Declaration(decl) {
      if (decl.prop !== "inset") return;
      const val = decl.value;
      decl.cloneBefore({ prop: "top",    value: val });
      decl.cloneBefore({ prop: "right",  value: val });
      decl.cloneBefore({ prop: "bottom", value: val });
      decl.replaceWith({ prop: "left",   value: val });
    },
  };
}
expandInset.postcss = true;

export default {
  plugins: ["@tailwindcss/postcss", stripCascadeLayers, stripSingleArgWhere, expandInset],
};
