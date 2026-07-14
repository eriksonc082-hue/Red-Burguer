---
name: Tailwind v4 + Google Fonts @import order
description: Build-time CSS error when mixing @import url(...) with Tailwind v4's @import 'tailwindcss'.
---

With Tailwind v4 (`@import 'tailwindcss'` at the top of the main CSS file), any other `@import` (e.g. a Google Fonts `@import url(...)`) placed *after* it fails the build with:

`[vite:css][postcss] @import must precede all other statements (besides @charset or empty @layer)`

This happens because `@import 'tailwindcss'` expands into a large amount of inlined CSS during processing, so anything textually after it is treated as "other statements" that a later `@import` can't precede — even though in the original source it looks like just another import at the top of the file.

**Fix:** put external `@import url(...)` statements (fonts, etc.) *before* `@import 'tailwindcss'`, not after.
**How to apply:** whenever adding a Google Fonts (or any external) CSS `@import` to a Tailwind v4 project's main stylesheet, place it as the very first line(s), ahead of the Tailwind import.
