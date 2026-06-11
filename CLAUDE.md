# Athlion V2 — Frontend (Guide Claude Code)

App web responsive (mobile-first) du projet de coaching Athlion. **React + Vite + TypeScript**,
design system « glass » (`src/styles/athlion-tokens.css`). Textes en **français**.

## Stack & conventions

- **Vite 5 / React 18 / TypeScript strict**.
- **TanStack Query** = état serveur (clé : `['dashboard']`, etc.). Invalidation en cascade
  qui reflète « tout réagit à l'état athlète ».
- **React Router 6** : routes protégées via `<Protected>` + `AppShell` (nav basse fixe).
- **Organisation par feature** : `src/features/{auth,dashboard,sleep,planning,nutrition,coach,profile}`.
- Primitives UI = classes du design system (`.card`, `.btn`, `.metric-card`, `.nav-bar`…).
  Ne pas réinventer de styles : réutiliser `athlion-tokens.css`.

## Backend

- API live : `https://api.fleet-commander.space/athlion-v2/api`
- Configurable via `VITE_API_URL` (cf. `.env.example`). Défaut = backend live.
- Client unique : `src/lib/api.ts` (injecte le JWT, gère le 401 → /login).
- Token dans `localStorage["athlion_token"]`.

## Développement

```bash
npm install
npm run dev      # http://localhost:5173 → tape le backend live
```

Compte de test : un email de `ALLOWED_EMAILS` côté backend, mot de passe `1234`.

## Build & déploiement

```bash
npm run build    # tsc -b && vite build → dist/
```

- **Déploiement : Vercel**, depuis le repo GitHub `onlyelo/Athlion-V2`.
- `vercel.json` : rewrites SPA (toutes les routes → index.html).
- Variable Vercel à définir : `VITE_API_URL=https://api.fleet-commander.space/athlion-v2`.
- ⚠️ Le domaine Vercel doit être autorisé dans le CORS backend (`server.js`).

## État d'avancement

- ✅ **Phase 1** : auth, shell + nav, dashboard (état athlète live), profil.
- ⏳ Sommeil (API prête, écran à faire), Planning (P2), Nutrition (P3), Coach (P4), Garmin (P5).

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour la vision d'ensemble.
