# Stratify — Design System

The brand and product design system for **Stratify** (`Stratify_gg`) — a mobile **esports team-management** game/app. Players run a competitive CS-style org: build a roster, train skills, bid for talent in a transfer market, follow matches, and climb a global ranking. The interface is a dark "management cockpit"; the copy is Brazilian Portuguese.

This system packages the brand's visual foundations, reusable React components, and an interactive recreation of the app so design agents can produce on-brand interfaces and assets.

## Sources
- **Codebase:** `Stratify_gg/` — an Expo / React Native (expo-router) + NativeWind app backed by Supabase. Screens recreated here: `app/login/index.tsx`, `app/dashboard/index.tsx`, `app/dashboard/market/index.tsx`, plus `components/ui/*` (TeamCard, PercentageCard, etc.). Theme colors are inline per-screen `StyleSheet` objects, not a central token file — this system extracts and formalizes them.
- **Brand mark:** `assets/stratify-logo.png` (full crest on navy plate) and `assets/stratify-crest.png` (crest only), both from the app's `assets/images/stratify-logo.png`.
- No Figma file was provided.

> ⚠ **Font substitution.** The native app renders in the platform system font (SF Pro / Roboto). For web artifacts this system substitutes **Archivo** (heavy grotesque display) + **Geist Mono** (stat numerals) from Google Fonts. If you have brand-licensed fonts, drop them in `assets/fonts/` and swap the `@import` in `tokens/fonts.css` for local `@font-face` rules.

---

## CONTENT FUNDAMENTALS

**Language.** Brazilian Portuguese, throughout. (e.g. *Gerencie seu time. Conquiste o topo.* / *Orçamento disponível* / *Dar Lance* / *Nenhuma notificação*.)

**Voice.** Confident, energetic, esports-native — like a team HUD, not a corporate dashboard. Direct imperatives address the user as the manager: *Entrar*, *Treinar*, *Contratar jogadores*, *Ver detalhes*. Second person ("seu time", "Você"), never first person.

**Casing.** This is the signature. UI labels, section headers, button text, status pills and the wordmark are **UPPERCASE** with wide letter-spacing: `STRATIFY`, `AÇÕES RÁPIDAS`, `TIME PRINCIPAL`, `PRÓXIMA PARTIDA`, `ONLINE`, `LESÃO`, `VER DETALHES`. Body copy, field labels, and helper text stay sentence case.

**Numbers & jargon.** Stats are king and always shown as compact figures: ratings (`91`), records (`34-11`), money (`$8.4M`, `$420K`), countdowns (`02:14:08`), averages (`88.4 AVG`). Esports role vocabulary is used verbatim: *AWPer, IGL, Rifler, Entry Fragger, Support, Lurker*. Player status: *ONLINE / LESÃO (injury) / BANIDO (banned)*.

**Tone examples.**
- Hero: `FINAL DO TORNEIO` · `vs. Team Liquid`
- Notification (success): "Sua proposta por 'kRavenz' foi aceita. Bem-vindo ao time!"
- Empty state: "Nenhum jogador ainda" / "Nenhuma notificação" — plain, never cute.
- Errors: short, prefixed with `⚠`: "E-mail ou senha inválidos."

**Emoji.** Used sparingly and functionally as wayfinding glyphs on action cards and headers (🎯 treinar, 🏪 mercado, 📋 táticas, 🎮 partidas, 🔔 notificações, 🔍 search, ⏱ timer). Never decorative in prose.

---

## VISUAL FOUNDATIONS

**Overall mood.** A dark, high-contrast "control room." Almost everything sits on near-black; color is rationed and meaningful.

**Color.**
- **Surfaces** are a tight near-black ramp: app `#080808` → card `#0D0D0D` → raised `#111` → control `#161616` → hover `#1A1A1A`. Depth comes from *stacking these one-step lighter*, not from shadows.
- **Emerald `#10B981`** is the product accent — the working "primary": CTAs, focus rings, brand dot, success, the active segment. This is what users perceive as the app color.
- **Crimson `#C8202E` + navy `#0E1420`** belong to the **logo crest** (shield, flame, headset players). Heritage/brand-mark palette — use for the logo lockup, not as UI accent. Don't fill buttons crimson.
- A **multi-hue role/status palette** tags content: danger red (injury/alert/destructive), warning amber (ban/energy), info indigo (market/IGL), pink (matches/AWPer), blue (awareness), purple (game-sense). Always used as a *small* tinted fill (~12%) + 30% ring, rarely as a solid.
- **Text** is a 5-step gray ramp on dark: `#FFFFFF → #9CA3AF → #6B7280 → #4B5563 → #374151`.

**Type.** Heavy and athletic. Display/headers are weight **800–900**, uppercase, with wide tracking (`0.04em` labels → `0.12em` eyebrows → `0.28–0.34em` wordmark). Body is a clean grotesque at 13–15px / 1.5. All numbers/stats render in **tabular mono** (Geist Mono) so columns of figures align.

**Spacing & layout.** 4px base grid. **16px screen gutter**, 14–24px card padding. Mobile-first single column; KPIs and action cards in a 2-col grid. Minimum tap target 44px. Primary CTA is 48px tall, full-width.

**Backgrounds.** No photography or illustration in-product. The one recurring atmospheric is a **soft emerald radial glow** behind auth/hero headers (`radial-gradient(circle at 50% 0%, rgba(16,185,129,0.10), transparent 60%)`). Hero cards use a subtle **emerald-tinted black gradient** (`#0D1F16 → #111`). No busy patterns, no noise/grain.

**Borders.** The primary depth cue. Hairline **1px** borders in a dark ladder (`#1A1A1A → #1F1F1F → #242424 → #2A2A2A`) outline nearly every card, input and control. Inputs use 1.5px and brighten to emerald on focus.

**Corners.** Moderate and consistent: tags 4px, chips/rating 6px, buttons/inputs 8px, list cards 12px, primary cards 14px, hero/modal 16px, bottom-sheets 20px top corners, pills fully round.

**Shadows & glow.** Drop shadows are used *only* for floating surfaces (bottom-sheets `0 -8px 40px rgba(0,0,0,.6)`, modals). Everywhere else, "elevation" is an **emerald glow**: a 1px emerald ring (`0 0 0 1px rgba(16,185,129,.30)`) + soft bloom (`0 0 24px rgba(16,185,129,.18)`) on active/highlighted cards and focused inputs.

**Cards.** Dark surface (`#0D0D0D`), 1px hairline border, 12–14px radius, 16px padding. Highlighted variant swaps the border for the emerald ring + bloom. No left-accent-border cards.

**Hover / press.** Web hover brightens a control one surface step (or `filter: brightness(1.15)` for icon buttons). Press mimics React Native `TouchableOpacity`: opacity dips to ~0.78–0.85 **and** a slight `scale(0.97)` (icon buttons 0.92). Transitions are quick (120–200ms) on a standard ease `cubic-bezier(0.2,0,0,1)`.

**Motion.** Restrained. Bottom-sheets slide up (~320ms). Stat bars animate width on mount. Spinners rotate. No bounce, no parallax, no infinite decorative loops.

**Transparency & blur.** Modal scrim is `rgba(0,0,0,0.7)` (no blur). Tinted fills are semi-transparent color over dark. Glass/blur effects are not part of the language.

---

## ICONOGRAPHY

The native app has **no icon font or SVG icon set** — it uses **emoji as functional glyphs** plus a few unicode characters. This system preserves that approach.

- **Emoji** carry meaning on action cards and headers: 🎯 treinar, 🏪 mercado, 📋 táticas, 🎮 partidas, 🔔 notificações, 🔍 buscar, ⏱ tempo/leilão, 🔕 vazio, ⚠ erro, 👁/🙈 mostrar senha.
- **Unicode glyphs** for chrome: `‹` `›` back/forward chevrons, `✕` close, `→` forward action, `▲ ▼` deltas, `＋` add.
- **Status** is shown with a colored **dot** (not an icon) + uppercase label.
- **No emoji in prose** — only as wayfinding affordances.

If you need a denser icon set for a new surface, substitute **Lucide** (1.5–2px stroke, rounded) as the closest match to the app's clean, light feel — and flag the substitution. Don't hand-draw SVG icons. Brand crest/logo lives in `assets/` — use those PNGs, never redraw them.

---

## INDEX / MANIFEST

**Root**
- `styles.css` — global entry; `@import`s all tokens + fonts. Consumers link this.
- `readme.md` — this guide. · `SKILL.md` — portable Agent-Skill wrapper.
- `assets/` — `stratify-logo.png` (crest on navy plate), `stratify-crest.png` (crest only).

**Tokens** (`tokens/`) — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css` (radii/shadow/glow/motion), `base.css` (reset).

**Foundation cards** (`guidelines/*.card.html`) — Colors (Surfaces, Emerald, Semantic, Text & borders), Type (Display, Body, Mono), Spacing (Scale, Radii), Brand (Logo & crest, Glow & gradient).

**Components** (`components/`) — each with `.jsx` + `.d.ts` + `.prompt.md`; mounted from `window.StratifyDesignSystem_<hash>`.
- `core/` — **Button**, **IconButton**, **Card** (+ SectionHeader), **Badge**, **Input**, **Avatar**.
- `esports/` — **RatingBadge**, **StatBar**, **PlayerListItem**, **KpiTile**.
- `navigation/` — **SegmentedTabs**.

**UI kits** (`ui_kits/`)
- `stratify_app/` — interactive app recreation: login → dashboard → transfer market, with notifications + bid bottom-sheets. See its `README.md`.

**Starting points** — Button, Card, PlayerListItem, KpiTile (tagged in their `.d.ts`).
