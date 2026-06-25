---
name: stratify-design
description: Use this skill to generate well-branded interfaces and assets for Stratify (Stratify_gg), an esports team-management mobile app, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick map
- `readme.md` — full design guide: product context, content fundamentals, visual foundations, iconography, manifest.
- `styles.css` — single entry point; `@import`s every token + font file. Link this.
- `tokens/` — colors, typography, spacing, effects (radii/shadows/glow/motion), base reset.
- `guidelines/*.card.html` — foundation specimen cards (colors, type, spacing, brand).
- `components/` — React primitives (`core/`, `esports/`, `navigation/`), each with `.jsx` + `.d.ts` + `.prompt.md`.
- `ui_kits/stratify_app/` — interactive recreation of the app (login → dashboard → market).
- `assets/` — logo + crest PNGs.

## The one-line vibe
Dark esports cockpit: near-black surfaces, **emerald** product accent, heavy uppercase letter-spaced headers, tabular-mono stats, hairline borders + subtle emerald glow. Copy is Brazilian Portuguese, confident and energetic.
