// ─── iOS 12 / Safari 12 compatibility plugins ──────────────────────────────
//
// 1. stripCascadeLayers  — hoists @layer block contents to parent scope.
//    Safari 12 drops the entire content of unknown @-rule blocks.
//
// 2. stripSingleArgWhere — unwraps :where(X) → X for single-argument cases.
//    Safari 12 drops rules whose selectors contain unknown pseudo-classes.
//
// 3. expandInset  — expands `inset: value` to top/right/bottom/left.
//    The CSS `inset` shorthand requires Safari 14.1.
//
// 4. inlineSpacingVar  — replaces var(--spacing) with 0.25rem.
//    Tailwind v4 defines --spacing as `.25rem` (no leading zero); this bare
//    decimal fails to resolve as a custom-property value on iOS 12, collapsing
//    every margin/padding/gap to zero.
//
// 5. inlineColorVars  — replaces var(--color-*) with literal hex values.
//    Same parsing failure as --spacing: Tailwind generates text-gray-400 as
//    color:var(--color-gray-400). When the variable fails to resolve the text
//    becomes transparent, making labels like "Ranking System" invisible.
//
// 6. resolveColorMix  — converts color-mix() to rgba().
//    Tailwind v4 generates color-mix(in oklab, #hex XX%, transparent) for
//    every named-color + opacity utility (bg-black/60, border-yellow-400/40
//    etc). color-mix() requires Safari 16.2; on iOS 12 the entire declaration
//    is ignored, making player-row backgrounds and borders fully transparent.
// ───────────────────────────────────────────────────────────────────────────

function stripCascadeLayers() {
  return {
    postcssPlugin: "strip-cascade-layers",
    AtRule: {
      layer(node) {
        if (node.nodes?.length) node.replaceWith(node.nodes);
        else node.remove();
      },
    },
  };
}
stripCascadeLayers.postcss = true;

function unwrapWhere(selector) {
  let out = "", i = 0;
  while (i < selector.length) {
    const wi = selector.indexOf(":where(", i);
    if (wi === -1) { out += selector.slice(i); break; }
    out += selector.slice(i, wi);
    let depth = 1, j = wi + 7;
    while (j < selector.length && depth > 0) {
      if (selector[j] === "(") depth++;
      else if (selector[j] === ")") depth--;
      if (depth > 0) j++;
    }
    const inner = selector.slice(wi + 7, j);
    let d = 0, hasComma = false;
    for (const ch of inner) {
      if (ch === "(") d++;
      else if (ch === ")") d--;
      else if (ch === "," && d === 0) { hasComma = true; break; }
    }
    out += hasComma ? selector.slice(wi, j + 1) : inner;
    i = j + 1;
  }
  return out;
}

function stripSingleArgWhere() {
  return {
    postcssPlugin: "strip-single-arg-where",
    Rule(rule) {
      if (rule.selector.includes(":where("))
        rule.selectors = rule.selectors.map(unwrapWhere);
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

function inlineSpacingVar() {
  return {
    postcssPlugin: "inline-spacing-var",
    Declaration(decl) {
      if (decl.value.includes("var(--spacing)"))
        decl.value = decl.value.replaceAll("var(--spacing)", "0.25rem");
    },
  };
}
inlineSpacingVar.postcss = true;

// Runs in OnceExit so it sees the full document after all other plugins.
function inlineColorVars() {
  return {
    postcssPlugin: "inline-color-vars",
    OnceExit(root) {
      const vars = {};
      root.walkDecls(/^--color-/, (decl) => { vars[decl.prop] = decl.value; });
      root.walkDecls((decl) => {
        if (!decl.value.includes("var(--color-")) return;
        decl.value = decl.value.replace(
          /var\(--color-([^)]+)\)/g,
          (match, name) => vars[`--color-${name}`] ?? match
        );
      });
    },
  };
}
inlineColorVars.postcss = true;

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Runs in OnceExit so it sees color vars already inlined by inlineColorVars.
function resolveColorMix() {
  return {
    postcssPlugin: "resolve-color-mix",
    OnceExit(root) {
      const RE = /color-mix\(\s*in\s+[\w-]+\s*,\s*(#[0-9a-fA-F]{3,8})\s+([\d.]+)%\s*,\s*transparent\s*\)/g;
      root.walkDecls((decl) => {
        if (!decl.value.includes("color-mix(")) return;
        decl.value = decl.value.replace(RE, (_, hex, pct) => {
          const [r, g, b] = hexToRgb(hex);
          return `rgba(${r},${g},${b},${(parseFloat(pct) / 100).toFixed(3)})`;
        });
      });
    },
  };
}
resolveColorMix.postcss = true;

export default {
  plugins: [
    "@tailwindcss/postcss",
    stripCascadeLayers,
    stripSingleArgWhere,
    expandInset,
    inlineSpacingVar,
    inlineColorVars,
    resolveColorMix,
  ],
};
