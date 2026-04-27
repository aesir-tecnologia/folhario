"use strict";

const stylelint = require("stylelint");

const ruleName = "folhario/keyframes-requires-reduced-motion-fallback";
const messages = stylelint.utils.ruleMessages(ruleName, {
  noFallback: (name) =>
    `@keyframes "${name}" must be paired with a @media (prefers-reduced-motion: reduce) reset (D-08 layer 3). ` +
    `Either gate the @keyframes inside @media (prefers-reduced-motion: no-preference) OR add a sibling ` +
    `@media (prefers-reduced-motion: reduce) block that resets the consuming selectors' animation/transition.`,
});

const meta = { url: "" };

/**
 * D-08 layer 3 — Stylelint custom rule.
 *
 * For every top-level `@keyframes <name>` declaration, walk the same root and
 * verify that EITHER:
 *   (a) the @keyframes is itself nested inside `@media (prefers-reduced-motion: no-preference) { ... }`, OR
 *   (b) somewhere in the same root there exists `@media (prefers-reduced-motion: reduce) { ... }`
 *       (we don't try to match exact selectors — presence of the media query is the contract;
 *        designers acknowledge motion exists and provide a reset path).
 *
 * Rationale: D-08 calls for a CSS gate that complements the runtime hook +
 * Tailwind variant. This rule does NOT replicate semantic correctness checks
 * (which selectors are reset, which animations are paused) — it enforces the
 * minimum architectural contract: every motion stylesheet ships a reduced-motion
 * sibling block. False positives are avoided by skipping ignored files
 * (configured at consumer level via stylelint.config.mjs ignoreFiles).
 */
function rule(primary) {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true],
    });
    if (!validOptions) return;

    // Collect all @media (prefers-reduced-motion: reduce) blocks in this root.
    let hasReducePrefersBlock = false;
    root.walkAtRules("media", (atRule) => {
      const params = (atRule.params || "").replace(/\s+/g, " ");
      if (/prefers-reduced-motion:\s*reduce/i.test(params)) {
        hasReducePrefersBlock = true;
      }
    });

    root.walkAtRules("keyframes", (kfNode) => {
      // Allow path (a): @keyframes nested inside @media (prefers-reduced-motion: no-preference).
      let parent = kfNode.parent;
      let nestedInsideNoPreference = false;
      while (parent && parent.type !== "root") {
        if (
          parent.type === "atrule" &&
          parent.name === "media" &&
          /prefers-reduced-motion:\s*no-preference/i.test((parent.params || "").replace(/\s+/g, " "))
        ) {
          nestedInsideNoPreference = true;
          break;
        }
        parent = parent.parent;
      }
      if (nestedInsideNoPreference) return;

      // Path (b): root-level @keyframes — require a sibling @media (prefers-reduced-motion: reduce).
      if (!hasReducePrefersBlock) {
        stylelint.utils.report({
          message: messages.noFallback(kfNode.params || "<unnamed>"),
          node: kfNode,
          result,
          ruleName,
        });
      }
    });
  };
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

module.exports = stylelint.createPlugin(ruleName, rule);
