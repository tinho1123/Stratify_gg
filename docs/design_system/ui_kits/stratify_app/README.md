# Stratify App — UI Kit

High-fidelity recreation of the **Stratify_gg** mobile app (Expo / React Native + NativeWind), rebuilt as an interactive web click-through that composes this design system's components.

## Run
Open `index.html`. The app boots on the **login** screen inside a phone frame.

## Flow
1. **Login** — tap **Entrar** (any/empty credentials) → dashboard.
2. **Dashboard** — hero next-match countdown, KPI grid, roster (`PlayerListItem`), quick actions, performance bars (`StatBar`). Tap the **🔔 bell** to open the notifications bottom-sheet. Tap **MERCADO** in Quick Actions → market.
3. **Market** — search, role filter pills, sort segmented control, auction cards. Tap any card → **bid bottom-sheet** with the player's skill bars. Tap **‹** to return.

## Files
- `index.html` — app shell: phone frame, status bar, screen router, notifications sheet.
- `LoginScreen.jsx` / `DashboardScreen.jsx` / `MarketScreen.jsx` — the three surfaces.
- `data.js` — mock data mirroring the real Supabase schema (`teams`, `players`, `notifications`, auctions). Content is invented stand-in data.

## Source of truth
Recreated from the `Stratify_gg/` codebase — `app/login/index.tsx`, `app/dashboard/index.tsx`, `app/dashboard/market/index.tsx`. Copy is Brazilian Portuguese, matching the app. Tactics / Partidas / Training quick-actions are intentionally inert (not built here).
