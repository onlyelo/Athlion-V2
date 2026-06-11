# Athlion V2 — Architecture (document de travail)

> Statut : **proposition à évaluer**. Aucune ligne de code applicatif n'est encore écrite.
> Décisions actées : sommeil = saisie manuelle puis Garmin · plateforme = web responsive · planning = hybride règles+LLM.

---

## 1. Principe directeur : architecture pilotée par signaux

Toutes les fonctionnalités sont interconnectées (sommeil → planning → nutrition → charge → niveau…).
Plutôt que de faire dialoguer les modules entre eux (spaghetti), on introduit **un état athlète central** :

- les **sources** écrivent uniquement des **signaux bruts** ;
- l'**état athlète** est une couche **dérivée et matérialisée** (recalculée à chaque signal) ;
- les **moteurs** lisent l'état, jamais les sources directement.

Résultat : chaque moteur est isolé, testable, et remplaçable. Brancher Garmin demain = ajouter une source, rien d'autre ne bouge.

```
Sources ──▶ État athlète (matérialisé) ──▶ Moteurs ──▶ App
   ▲                                          │
   └────────── boucle de réconciliation ◀─────┘
              (prescrit vs réalisé → ajuste niveau & charge)
```

---

## 2. Couches & responsabilités (backend)

| Couche | Rôle | Ne fait PAS |
|---|---|---|
| `routes/` | HTTP mince : valide la requête, appelle un service | aucune logique métier |
| `services/` | Orchestration métier, transactions | calcul lourd, SQL brut |
| `engines/` | **Calcul pur**, sans I/O (entrée → sortie) | accès DB, appels réseau |
| `repositories/` | Accès DB (requêtes SQL) | logique métier |
| `providers/` | Intégrations externes abstraites (LLM, Strava, sommeil) | logique métier |
| `events/` | Bus de recalcul in-process | calcul (délègue aux services) |
| `jobs/` | Tâches planifiées (coach, digests) | — |

Règle d'or : un **engine** ne touche jamais la base ni le réseau. Ça les rend testables sans infra et déterministes.

---

## 3. Arborescence cible

### Backend (Express / CommonJS — on conserve la base existante)

```
backend/
├── server.js                  # bootstrap + montage des routes + démarrage du bus
├── config/database.js         # (existant) pool pg
├── middleware/auth.js         # (existant) JWT
├── scripts/init.sql           # schéma (étendu — voir §5)
├── data/passwords.json        # (existant) comptes
│
├── routes/                    # couche HTTP
│   ├── auth.js  profile.js  dashboard.js
│   ├── sleep.js  training.js  nutrition.js  coach.js
│   ├── strava.js              # OAuth + webhook entrant
│   └── garmin.js              # OAuth + sync   (PHASE 2)
│
├── services/                  # orchestration
│   ├── athleteStateService.js # ★ recompose l'état athlète
│   ├── planService.js  sleepService.js
│   ├── nutritionService.js  coachService.js
│
├── engines/                   # calcul pur (zéro I/O)
│   ├── loadEngine.js          # TSS, CTL / ATL / TSB
│   ├── periodizationEngine.js # macro déterministe (base→build→peak→taper)
│   ├── planningEngine.js      # hybride : squelette + appel LLM
│   ├── adaptationEngine.js    # ajustements temps réel (règles)
│   ├── reconciliationEngine.js# prescrit ↔ réalisé
│   ├── sleepEngine.js         # dette de sommeil + courbe circadienne (RISE)
│   └── nutritionEngine.js     # besoins énergétiques du jour
│
├── providers/                 # intégrations externes abstraites
│   ├── llm/
│   │   ├── client.js          # Anthropic SDK
│   │   └── prompts/           # prompts versionnés (planning, coach, menus)
│   ├── strava/stravaClient.js
│   └── sleep/                 # ★ abstraction clé
│       ├── SleepProvider.js   #   interface commune
│       ├── manualProvider.js  #   PHASE 1
│       └── garminProvider.js  #   PHASE 2
│
├── repositories/              # accès DB
│   └── userRepo.js  signalRepo.js  stateRepo.js  planRepo.js  …
│
├── events/
│   ├── bus.js                 # EventEmitter in-process
│   └── handlers.js            # ex : onStravaActivity → recompute state
│
└── jobs/
    ├── scheduler.js           # cron léger
    └── coachDigest.js         # analyse quotidienne / hebdo
```

### Frontend (React / Vite / TypeScript — organisation par feature)

```
frontend/
├── index.html  vite.config.ts  tsconfig.json
└── src/
    ├── main.tsx  App.tsx               # routing + providers
    ├── styles/
    │   ├── athlion-tokens.css          # ★ le design system fourni (tel quel)
    │   └── global.css
    ├── lib/
    │   ├── api.ts                      # client fetch + injection JWT
    │   ├── queryClient.ts              # TanStack Query (état serveur)
    │   └── format.ts                   # semaines ISO, unités, dates
    ├── components/                     # primitives UI = mapping 1:1 du design system
    │   ├── Card  Button  Badge  MetricCard  Input
    │   ├── SectionLabel  BottomNav  ActivityItem
    │   └── …
    ├── contexts/AuthContext.tsx
    ├── hooks/  useAuth.ts  useAthleteState.ts
    ├── features/                       # un dossier par pilier
    │   ├── dashboard/                  # widgets + épinglage favoris
    │   ├── sleep/                      # module RISE
    │   ├── planning/                   # semaine + macro + objectifs
    │   ├── nutrition/                  # menus + batch cooking + courses
    │   ├── coach/                      # analyses + chat
    │   └── profile/                    # métriques + intégrations (Strava/Garmin)
    └── types/                          # contrats partagés (miroir API)
```

**Choix front :**
- **TanStack Query** pour l'état serveur : parfait pour le « tout réagit à tout » — quand l'état athlète change, on invalide et l'UI se met à jour en cascade.
- **Feature folders** plutôt que par type : chaque pilier est autonome.
- **Couche `components/`** = traduction stricte du design system (`.card`, `.btn`, `.metric-card`…) en composants typés.

---

## 4. Comment chaque fonctionnalité se branche

| Fonctionnalité | Mécanisme | Faisabilité |
|---|---|---|
| **Dashboard + favoris** | Widgets lisant l'état ; épinglage stocké en JSONB (`dashboard_layout`) | Facile |
| **Charge** | `loadEngine` : TSS → CTL/ATL/TSB (modèle Banister, std TrainingPeaks) | Éprouvée |
| **Sommeil (RISE)** | `sleepEngine` : dette cumulée 14j + besoin perso + courbe circadienne. Source via `SleepProvider` (manuel → Garmin) | Logique OK ; dépend de la source |
| **Planning IA** | Hybride : `periodizationEngine` (macro) + `planningEngine` (LLM mise en séances) + `adaptationEngine` (règles temps réel) | Cœur du projet |
| **Niveau dynamique** | `reconciliationEngine` : matche Strava ↔ séance prescrite → `discipline_levels` | Faisable (matching = le défi) |
| **Objectifs court/moyen/long** | Table `goals` (horizon), générés IA, éditables user | Facile |
| **Nutrition** | `nutritionEngine` : besoins depuis charge → LLM menus → batch cooking | Moyenne |
| **Coach IA** | `jobs/coachDigest` planifié : lit l'état, écrit insights + questions | Bonne |
| **Profil & métriques** | CRUD direct | Facile |

---

## 5. Modèle de données (au niveau conceptuel)

Tables existantes conservées : `users`, `athlete_profiles`, `metrics_history`, `objectives`,
`weekly_plans`, `training_sessions`, `feedback_logs`, `strava_tokens`,
`training_plans`, `session_analyses`, `strava_activities_cache`.

### Ajouts proposés

**État athlète (le pivot)**
- `daily_state` — *matérialisé, 1 ligne / jour* : `ctl, atl, tsb, readiness, sleep_debt_min, energy_curve(JSONB), computed_at`
- `discipline_levels` — niveau dynamique : `sport, level_estimate, confidence, updated_at`

**Sommeil (RISE)**
- `sleep_logs` : `date, source('manual'|'garmin'), bedtime, wake_time, duration_min, phases(JSONB), hrv_ms, resting_hr, raw(JSONB)`
- `sleep_profile` : `sleep_need_min, chronotype, melatonin_window(JSONB)`

**Planning multi-niveaux**
- `goals` : `horizon('short'|'mid'|'long'), title, target_date, type, metrics(JSONB), source('ai'|'user'), status`
- `macro_plans` : `start_date, end_date, blocks(JSONB = phases + cibles de charge), status`
- `training_sessions` → **enrichir** : `prescribed(JSONB)`, `executed(JSONB)`, `completion_ratio`, `adaptation_reason`

**Contraintes pro**
- `availability` : `date|weekday, start_time, end_time, type('work'|'admin'|'blocked'), note`

**Nutrition**
- `nutrition_targets` : `date, kcal, protein_g, carb_g, fat_g, derived_from(JSONB)`
- `meal_plans` : `week, menu(JSONB), batch_plan(JSONB), shopping_list(JSONB), status`

**Coach & Dashboard**
- `coach_insights` : `scope('day'|'week'), content, questions(JSONB), created_at`
- `dashboard_layout` : `pinned(JSONB = widgets + ordre), updated_at`

**Garmin (phase 2)** : `garmin_tokens` (ou colonnes sur `users`, comme Strava).

Conventions : UUID partout, `ON DELETE CASCADE` sur `user_id`, JSONB pour le flexible, semaines en ISO-8601.

---

## 6. Le flux de recalcul (cœur vivant du système)

```
1. Signal entrant        POST /sleep | webhook Strava | POST /feedback | POST /availability
2. Persistance brute     repository écrit le signal
3. Émission événement    bus.emit('signal:strava', { userId, date })
4. Recompute état        athleteStateService.recompute(userId, date)
                           ├─ loadEngine           → CTL / ATL / TSB
                           ├─ sleepEngine          → dette + courbe énergie
                           ├─ reconciliationEngine → met à jour discipline_levels
                           └─ écrit daily_state
5. Adaptation            adaptationEngine compare séances à venir vs nouvel état
                           ├─ ajustement mineur  → règles (intensité/volume)
                           └─ ajustement majeur  → flag « regénération LLM » (throttlé)
6. Front                 TanStack Query invalide → l'UI se met à jour
```

**Choix d'échelle :** bus **in-process** (EventEmitter) suffisant sur un seul VPS.
Migration vers une vraie file (Redis/BullMQ) = étape future si le volume l'exige. Documenté, pas prématuré.

---

## 7. Le LLM : où, et avec quelles garanties

- **Provider isolé** (`providers/llm`) — un seul point d'appel, prompts versionnés.
- **Le LLM propose, les règles disposent** : il génère des séances/menus/analyses, mais
  les contraintes dures (dispo, charge max, sécurité) sont validées par des règles **après** génération.
- **Jamais dans le flux temps réel** : l'adaptation immédiate est à base de règles (rapide, gratuit, prévisible).
  Le LLM n'est appelé que sur action explicite (générer une semaine) ou en job planifié (coach).
- Modèles : `claude-haiku-4-5` pour le volume/chat, `claude-sonnet-4-6` pour la génération de plan complexe.

---

## 8. Intégrations externes

| Intégration | Mécanisme | Phase |
|---|---|---|
| **Strava** | OAuth + **webhook** (push d'activité) → ingestion temps réel | 1 |
| **Sommeil manuel** | Formulaire → `manualProvider` | 1 |
| **Garmin** | OAuth serveur → `garminProvider` (même interface `SleepProvider`) | 2 |
| **Claude** | Anthropic SDK via `providers/llm` | 1+ |

L'abstraction `SleepProvider` garantit que passer du manuel à Garmin **n'impacte ni `sleepEngine` ni l'UI**.

---

## 9. Roadmap de phases (proposée)

- **Phase 0** — Validation de cette architecture. ⟵ *on est ici*
- **Phase 1 — Socle** : auth, état athlète, ingestion Strava + charge (CTL/ATL/TSB), dashboard + favoris, profil/métriques, saisie sommeil manuelle.
- **Phase 2 — Planning** : périodisation macro, génération hebdo hybride, adaptation temps réel, réconciliation, objectifs multi-horizon.
- **Phase 3 — Nutrition** : besoins, menus, batch cooking, listes de courses.
- **Phase 4 — Coach IA** : analyses planifiées + questions + chat.
- **Phase 5 — Garmin** : connecteur sommeil (complète/remplace la saisie manuelle).

---

## 10. Points ouverts à trancher ensemble

1. **Gestion d'état front** : TanStack Query (recommandé) confirmé ou préférence autre ?
2. **TypeScript strict** sur le backend aussi, ou on garde le backend en JS et seul le front en TS ?
3. **Garmin** : API « Health » (push) vs « Wellness » — à explorer en phase 2 (demande un compte développeur Garmin validé, délai possible).
4. **Matching prescrit↔réalisé** : règles de tolérance à définir (ex. 6×400 sur 8×400 prescrit = 75 % → échec ? seuil ?).
5. **Authentification** : on reste sur email/password + `passwords.json`, ou on rouvre Google OAuth (colonnes déjà prêtes) ?
