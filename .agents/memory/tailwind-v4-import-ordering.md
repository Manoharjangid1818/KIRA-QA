---
name: Tailwind v4 @import ordering
description: External @import statements must precede @import 'tailwindcss' in CSS-first Tailwind v4 configs, or PostCSS errors.
---

In Tailwind v4's CSS-first config style (`@import 'tailwindcss';` at the top of the stylesheet, with `@theme`/`@plugin` blocks), any *other* external `@import` (e.g. a Google Fonts URL) must come before `@import 'tailwindcss'`. If it comes after, PostCSS expands Tailwind's own rules first, and the later `@import` ends up sandwiched inside already-emitted CSS, producing "@import must precede all other statements (besides @charset or empty @layer)".

**Why:** Hit this in a fresh Vite + Tailwind v4 scaffold where a design pass added a Google Fonts `@import` after `@import 'tailwindcss'`/`@plugin` lines.

**How to apply:** Always place external `@import url(...)` lines first, before `@import 'tailwindcss'`, `@import 'tw-animate-css'`, or any `@plugin` directive, in the entry CSS file.
