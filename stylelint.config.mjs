/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["./tools/stylelint-plugins/keyframes-requires-reduced-motion.cjs"],
  rules: {
    // Tailwind v4 uses bare @import "tailwindcss" string notation (not url())
    "import-notation": "string",
    // Tailwind v4 at-rules: @theme, @utility, @custom-variant, @slot are not standard CSS
    "at-rule-no-unknown": [true, {
      ignoreAtRules: ["theme", "utility", "custom-variant", "slot", "layer", "apply", "variant"],
    }],
    // Tailwind v4 nesting (e.g., &:where(...)) does not require a scoping root in the standard sense
    "nesting-selector-no-missing-scoping-root": null,
    // Allow comments without preceding empty line for inline annotation style used in globals.css
    "comment-empty-line-before": null,
    // Allow at-rules without preceding empty line for Tailwind v4 blocks
    "at-rule-empty-line-before": null,
    "declaration-property-value-disallowed-list": {
      "color": [
        "/^#000000$/i",
        "/^#000$/i",
        "/^#fff(fff)?$/i",
        "/^black$/i",
        "/^white$/i",
      ],
      "background-color": [
        "/^#000000$/i",
        "/^#000$/i",
        "/^#fff(fff)?$/i",
        "/^black$/i",
        "/^white$/i",
      ],
      "font-family": [
        "/Inter/i",
        "/Times/i",
        "/Georgia/i",
        "/Garamond/i",
        "/Palatino/i",
      ],
      "backdrop-filter": ["/.*/"],
      "background-clip": ["/^text$/i"],
      "-webkit-background-clip": ["/^text$/i"],
      "-webkit-text-fill-color": ["/^transparent$/i"],
    },
    "folhario/keyframes-requires-reduced-motion-fallback": [true],
  },
  ignoreFiles: ["public/sw.js", "node_modules/**", ".next/**", ".planning/**"],
};
