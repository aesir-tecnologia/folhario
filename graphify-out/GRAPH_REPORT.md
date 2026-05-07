# Graph Report - folhario (2026-05-07)

## Corpus Check

- 409 files · ~262,201 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1329 nodes · 1875 edges · 254 communities (239 shown, 15 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 278 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `4803ac5b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- [[_COMMUNITY_Service Worker Internals|Service Worker Internals]]
- [[_COMMUNITY_Storage Adapter Layer|Storage Adapter Layer]]
- [[_COMMUNITY_UI Screens & Visual Design|UI Screens & Visual Design]]
- [[_COMMUNITY_IAM Application Layer|IAM Application Layer]]
- [[_COMMUNITY_Async Jobs & Inngest|Async Jobs & Inngest]]
- [[_COMMUNITY_E2E Test Infrastructure|E2E Test Infrastructure]]
- [[_COMMUNITY_Auth Middleware & Rate Limiting|Auth Middleware & Rate Limiting]]
- [[_COMMUNITY_Auth Login UI|Auth Login UI]]
- [[_COMMUNITY_JWT & Auth Adapter|JWT & Auth Adapter]]
- [[_COMMUNITY_SW Cache Engine|SW Cache Engine]]
- [[_COMMUNITY_PWA Serwist Cache Strategies|PWA Serwist Cache Strategies]]
- [[_COMMUNITY_Project Docs & Deploy Pipeline|Project Docs & Deploy Pipeline]]
- [[_COMMUNITY_Catalog API & Plant Routes|Catalog API & Plant Routes]]
- [[_COMMUNITY_API Pagination & Hashing|API Pagination & Hashing]]
- [[_COMMUNITY_Domain Model (DDDPRD)|Domain Model (DDD/PRD)]]
- [[_COMMUNITY_Storage Adapter Interface|Storage Adapter Interface]]
- [[_COMMUNITY_User Auth API Handlers|User Auth API Handlers]]
- [[_COMMUNITY_Feature Flags & Endpoints|Feature Flags & Endpoints]]
- [[_COMMUNITY_Photo Entry & Storage Paths|Photo Entry & Storage Paths]]
- [[_COMMUNITY_Auth Form Handlers|Auth Form Handlers]]
- [[_COMMUNITY_App Shell & Layouts|App Shell & Layouts]]
- [[_COMMUNITY_Offline Screen UI|Offline Screen UI]]
- [[_COMMUNITY_Auth Middleware & Idempotency|Auth Middleware & Idempotency]]
- [[_COMMUNITY_Subscription & Error Types|Subscription & Error Types]]
- [[_COMMUNITY_Catalog Grid & Sorting|Catalog Grid & Sorting]]
- [[_COMMUNITY_Profile & Analytics|Profile & Analytics]]
- [[_COMMUNITY_LGPD & Screen Inventory|LGPD & Screen Inventory]]
- [[_COMMUNITY_Business Behavior Rules|Business Behavior Rules]]
- [[_COMMUNITY_React Query & Local Storage|React Query & Local Storage]]
- [[_COMMUNITY_Test Fixtures & JWT Keys|Test Fixtures & JWT Keys]]
- [[_COMMUNITY_SW Request Handlers|SW Request Handlers]]
- [[_COMMUNITY_SW Network-First Strategy|SW Network-First Strategy]]
- [[_COMMUNITY_DB Migrations & RLS|DB Migrations & RLS]]
- [[_COMMUNITY_SW Runtime Cache Tests|SW Runtime Cache Tests]]
- [[_COMMUNITY_SW Cache Activation|SW Cache Activation]]
- [[_COMMUNITY_Sentry Error Tracking|Sentry Error Tracking]]
- [[_COMMUNITY_App Shell Components|App Shell Components]]
- [[_COMMUNITY_Accessibility Spec|Accessibility Spec]]
- [[_COMMUNITY_Brand Identity & Icons|Brand Identity & Icons]]
- [[_COMMUNITY_Location Combobox Tests|Location Combobox Tests]]
- [[_COMMUNITY_Combobox Component|Combobox Component]]
- [[_COMMUNITY_Inline Edit Field|Inline Edit Field]]
- [[_COMMUNITY_User Flow Diagrams|User Flow Diagrams]]
- [[_COMMUNITY_Copy & Microcopy (pt-BR)|Copy & Microcopy (pt-BR)]]
- [[_COMMUNITY_API Test Seed Helpers|API Test Seed Helpers]]
- [[_COMMUNITY_Bottom Sheet Component Tests|Bottom Sheet Component Tests]]
- [[_COMMUNITY_Plant Photo Upload|Plant Photo Upload]]
- [[_COMMUNITY_UX Goals & Core Loop|UX Goals & Core Loop]]
- [[_COMMUNITY_SW Callback Engine|SW Callback Engine]]
- [[_COMMUNITY_Date & Currency Formatting|Date & Currency Formatting]]
- [[_COMMUNITY_Catalog Data Hooks|Catalog Data Hooks]]
- [[_COMMUNITY_Account UI Components|Account UI Components]]
- [[_COMMUNITY_Photo Journal Tests|Photo Journal Tests]]
- [[_COMMUNITY_Add Plant Form|Add Plant Form]]
- [[_COMMUNITY_Storage Reconciler Tests|Storage Reconciler Tests]]
- [[_COMMUNITY_Storage Cleanup Tests|Storage Cleanup Tests]]
- [[_COMMUNITY_SW Handle Chain|SW Handle Chain]]
- [[_COMMUNITY_Plant Profile Mutation Tests|Plant Profile Mutation Tests]]
- [[_COMMUNITY_Modal Sheet Tests|Modal Sheet Tests]]
- [[_COMMUNITY_Offline Fallback Page|Offline Fallback Page]]
- [[_COMMUNITY_Lightbox Component|Lightbox Component]]
- [[_COMMUNITY_Offline Theme Variants|Offline Theme Variants]]
- [[_COMMUNITY_Get Plant Tests|Get Plant Tests]]
- [[_COMMUNITY_Partner Code Signup Tests|Partner Code Signup Tests]]

## God Nodes (most connected - your core abstractions)

1. `errorResponse()` - 52 edges
2. `CAVE-PRD Folhário MVP` - 31 edges
3. `es` - 24 edges
4. `eq` - 24 edges
5. `withUnitOfWork()` - 22 edges
6. `Folhário Project` - 20 edges
7. `Login Screen (Entrar) — Auth Gate` - 20 edges
8. `requireApiUser()` - 19 edges
9. `requireVerifiedUser()` - 19 edges
10. `withThrottle()` - 18 edges

## Surprising Connections (you probably didn't know these)

- `buildAdapterWithLocalJwks()` --calls--> `createAuthAdapter()` [INFERRED]
  tests/unit/auth-adapter.test.ts → src/contexts/iam/infrastructure/auth/auth-adapter.ts
- `deletePhotoEntry()` --calls--> `eq` [INFERRED]
  src/contexts/catalog/application/delete-photo-entry.ts → public/sw.js
- `list()` --calls--> `eq` [INFERRED]
  src/contexts/catalog/infrastructure/db/photo-entries.ts → public/sw.js
- `deletePhotoEntry()` --calls--> `eq` [INFERRED]
  src/contexts/catalog/infrastructure/db/photo-entries.ts → public/sw.js
- `bumpCoverFor()` --calls--> `eq` [INFERRED]
  src/contexts/catalog/infrastructure/db/photo-entries.ts → public/sw.js

## Communities (254 total, 15 thin omitted)

### Community 0 - "Service Worker Internals"

Cohesion: 0.05
Nodes (11): \_(), ed, ef, em, eu(), K, q(), R() (+3 more)

### Community 1 - "Storage Adapter Layer"

Cohesion: 0.07
Nodes (32): StorageAdapterError, createSupabaseStorageAdapter(), \_\_setSupabaseClientForTests(), buildTelemetryCallback(), createPlant(), extFromMime(), isAllowedMime(), deletePlant() (+24 more)

### Community 2 - "UI Screens & Visual Design"

Cohesion: 0.08
Nodes (46): CTA Button — Adicionar planta, Aparência (Appearance) Settings Section with Automático Dropdown, Authentication Guard - Redirects Unauthenticated Users to Login, Auth Redirect Gate — Catalog requires login, Bottom Navigation Bar, Bottom Navigation Bar, Catalog Empty State — Meu Jardim, Catalog Screen (Catálogo) (+38 more)

### Community 3 - "IAM Application Layer"

Cohesion: 0.07
Nodes (25): signupUser(), verifyEmail(), insertSignupConsents(), listByUser(), isPartnerCodeActive(), getCurrentPolicyVersions(), insertTrialingSubscription(), findById() (+17 more)

### Community 4 - "Async Jobs & Inngest"

Cohesion: 0.06
Nodes (14): focusFirstInvalid(), handleSubmit(), BottomSheetTestHarness(), BottomSheetTestPage(), ComboboxTestHarness(), ComboboxTestPage(), compressPlantPhoto(), handleSubmit() (+6 more)

### Community 5 - "E2E Test Infrastructure"

Cohesion: 0.09
Nodes (23): listForUser(), upsert(), fetchPendingBatch(), findById(), markCompleted(), markFailed(), markInProgress(), recordError() (+15 more)

### Community 6 - "Auth Middleware & Rate Limiting"

Cohesion: 0.08
Nodes (13): isUnverifiedAllowed(), \_\_setCurrentUserAdapterForTests(), createAuthContext(), setOfflineAndReload(), waitForServiceWorkerReady(), installInngestMock(), resetInngestMock(), seedActivePartnerCode() (+5 more)

### Community 7 - "Auth Login UI"

Cohesion: 0.11
Nodes (17): bumpThrottle(), isAuthFailure(), isCurrentlyLocked(), isOauthCallbackFailure(), withThrottle(), loginUser(), logoutUser(), GET() (+9 more)

### Community 8 - "JWT & Auth Adapter"

Cohesion: 0.17
Nodes (29): confirm(), constructUrls(), ensureVercelToken(), fail(), fetchApiKeys(), gitRepoSlug(), listSupabaseProjects(), main() (+21 more)

### Community 9 - "SW Cache Engine"

Cohesion: 0.08
Nodes (15): c(), d(), e\_, ei, en, eo, et, ex (+7 more)

### Community 10 - "PWA Serwist Cache Strategies"

Cohesion: 0.11
Nodes (4): ea(), ec(), es, ey()

### Community 11 - "Project Docs & Deploy Pipeline"

Cohesion: 0.09
Nodes (27): Auth Link: Ainda não tem conta? Criar conta, Auth Form Field: E-mail, Auth Link: Esqueci minha senha, Auth Login Screen Dark Mode, Auth Login Heading: Entrar, Auth Login Screen Light Mode, Auth Login Screen (Entrar form), Auth Form Field: Senha (+19 more)

### Community 12 - "Catalog API & Plant Routes"

Cohesion: 0.11
Nodes (15): createAuthAdapter(), defaultAudience(), defaultIssuer(), defaultJwksUrl(), getReadOnlySupabaseServerClient(), getSupabaseServerClient(), updateSessionInMiddleware(), hasBearer() (+7 more)

### Community 13 - "API Pagination & Hashing"

Cohesion: 0.14
Nodes (16): requireApiUser(), adapter(), getCurrentUser(), getCurrentUserFromSession(), completeOauthSignup(), resendVerification(), updateMyTimezone(), POST() (+8 more)

### Community 14 - "Domain Model (DDD/PRD)"

Cohesion: 0.14
Nodes (15): toPhotoEntrySnakeCase(), toPlantSnakeCase(), toPlantWithSignedUrlSnakeCase(), NotFound(), getCurrentUserFromSessionReadOnly(), getPlant(), listPhotoEntries(), CatalogPage() (+7 more)

### Community 15 - "Storage Adapter Interface"

Cohesion: 0.11
Nodes (23): CAVE-PRD Folhário MVP, Billing Bounded Context, Bounded Contexts (DDD), Catalog Bounded Context, CareGuide Entity, ConsentLog Entity, Identification Entity, Plant Entity (+15 more)

### Community 16 - "User Auth API Handlers"

Cohesion: 0.1
Nodes (5): InMemoryStorageAdapter, \_\_setStorageAdapterForTests(), buildMultipartBody(), buildPhotoEntryRequest(), buildPlantRequest()

### Community 17 - "Feature Flags & Endpoints"

Cohesion: 0.23
Nodes (11): getHandler(), postHandler(), decodeCursor(), decodeSortCursor(), encodeCursor(), encodeSortCursor(), normalizeLimit(), parseJsonBody() (+3 more)

### Community 18 - "Photo Entry & Storage Paths"

Cohesion: 0.16
Nodes (11): errorResponse(), upsertVerifiedTestUser(), isEnabled(), POST(), GET(), POST(), POST(), isEnabled() (+3 more)

### Community 19 - "Auth Form Handlers"

Cohesion: 0.13
Nodes (18): Folhário Project, BillingProvider Adapter, Drizzle ORM, Closed Error Code Registry, Next.js 16 App Router + React 19 + TS, Plant Identification, PostHog Analytics (US Cloud), Per-Provider Daily Cost Ceiling (+10 more)

### Community 20 - "App Shell & Layouts"

Cohesion: 0.27
Nodes (12): requireVerifiedUser(), computeMultipartRequestHash(), withIdempotency(), GET(), POST(), POST(), deletePhotoEntryHandler(), deletePlantHandler() (+4 more)

### Community 21 - "Offline Screen UI"

Cohesion: 0.28
Nodes (3): X(), y(), z

### Community 22 - "Auth Middleware & Idempotency"

Cohesion: 0.17
Nodes (6): createPhotoEntry(), deletePhotoEntry(), parsePlantPhotoKey(), StoragePathValidationError, validateStorageDeletionPrefix(), validateStorageObjectKey()

### Community 23 - "Subscription & Error Types"

Cohesion: 0.16
Nodes (4): handleClick(), startCooldown(), useAuthForm(), Button()

### Community 24 - "Catalog Grid & Sorting"

Cohesion: 0.21
Nodes (16): Vertically and Horizontally Centered Layout Pattern, Offline Body: Verifique sua conexão e tente novamente. Suas plantas salvas continuam disponíveis em Catálogo., Offline Screen — Dark + no-preference motion (macOS/Chromium), Offline Screen — Dark + no-preference motion (Linux/Chromium), Offline Screen — Dark + prefers-reduced-motion (macOS/Chromium), Offline Screen — Dark + prefers-reduced-motion (Linux/Chromium), Offline Heading: Você está offline., Leaf/Seed Icon (Offline State) (+8 more)

### Community 25 - "Profile & Analytics"

Cohesion: 0.19
Nodes (5): useSubscription(), PatchFailedError, ReadOnlyError, useDeletePlant(), usePatchPlantField()

### Community 26 - "LGPD & Screen Inventory"

Cohesion: 0.18
Nodes (6): PostHogProvider(), ProfileThemeSelect(), initPostHog(), getTheme(), isThemeValue(), setTheme()

### Community 27 - "Business Behavior Rules"

Cohesion: 0.15
Nodes (13): LGPD Rights (Export, Deletion, Consent Revocation), LGPD Compliance, Auth Screens (Login/Signup/Recovery), Catalog Screen (Meu Jardim), Home / Daily Summary Screen, Identify Screen (Picker/Loading/Results), LGPD Consent Modal, Plant Profile Screen (+5 more)

### Community 28 - "React Query & Local Storage"

Cohesion: 0.15
Nodes (13): Care Guide Runtime Augmentation, Identification Confidence Thresholds, Image Handling Behavior (Compression, EXIF Strip), Offline Sync Behavior (LWW, Idempotent), Per-User Identification Caps (trialing 5/day, active 15/day), Provider Routing (Backend Decides), Reminder Advance Rules (from_scheduled / from_acted), Reminder Timezone Handling (+5 more)

### Community 29 - "Test Fixtures & JWT Keys"

Cohesion: 0.33
Nodes (9): globalSetup(), publishJwks(), seedTestUser(), createTestJwks(), ensureKeys(), getTestPrivateKey(), getTestPublicJwk(), getTestPublicKey() (+1 more)

### Community 31 - "SW Network-First Strategy"

Cohesion: 0.3
Nodes (5): er, fetchLocations(), fetchPhotoEntries(), fetchPlantDetail(), fetchPlantsList()

### Community 32 - "DB Migrations & RLS"

Cohesion: 0.36
Nodes (7): closeMigrationSql(), getMigrationSql(), main(), fail(), main(), main(), main()

### Community 33 - "SW Runtime Cache Tests"

Cohesion: 0.18
Nodes (5): MockExpirationPlugin, MockNetworkFirst, MockNetworkOnly, MockSerwist, MockStaleWhileRevalidate

### Community 34 - "SW Cache Activation"

Cohesion: 0.18
Nodes (5): AppShell(), AppLayout(), LogoutLink(), UnverifiedBlocker(), QueryProvider()

### Community 35 - "Sentry Error Tracking"

Cohesion: 0.33
Nodes (5): isScrubKey(), makeBeforeBreadcrumb(), makeBeforeSend(), scrubHeaders(), scrubObject()

### Community 36 - "App Shell Components"

Cohesion: 0.18
Nodes (11): Identification Bounded Context, Inngest Async Work, Flow: Account Deletion (7-day grace), Flow: Add Plant to Catalog, Flow: Identify Plant, Flow: LGPD Data Export, Flow: Offline Sync Recovery, Flow: Reminder Fire & Action (+3 more)

### Community 37 - "Accessibility Spec"

Cohesion: 0.29
Nodes (5): AppUpdateToast(), restoreScroll(), saveScroll(), scrollKey(), setupScrollSaveListeners()

### Community 38 - "Brand Identity & Icons"

Cohesion: 0.2
Nodes (10): Alt Text Rules for User Photos, Color Not Sole Signal Principle, PWA Manifest (Installable, Standalone), prefers-reduced-motion Support, Accessibility & Responsiveness Spec, 44x44px Min Touch Targets, Color Palette (Canopy Green, Terracotta, Trust Teal, etc.), Visual Confidence Ladder (4-Redundant-Signal) (+2 more)

### Community 39 - "Location Combobox Tests"

Cohesion: 0.44
Nodes (10): Folhário Apple Touch Icon 180px, Folhário Brand Identity, Folhário Brand Logo (SVG), Brand Color: Dark Forest Green (#1F4D35), Brand Color: Warm Cream / Off-White (#FBF7EF), Brand Logotype: Letter F, Folhário PWA Manifest Icon 192px Maskable, Folhário PWA Manifest Icon 512px Maskable (+2 more)

### Community 40 - "Combobox Component"

Cohesion: 0.36
Nodes (6): buildVisible(), closeListbox(), commitOption(), computeGhostRow(), handleKeyDown(), openListbox()

### Community 41 - "Inline Edit Field"

Cohesion: 0.39
Nodes (7): cancel(), commit(), enterEditing(), handleBlurCommit(), handleReadKeyDown(), handleTextareaKeyDown(), handleTextKeyDown()

### Community 42 - "User Flow Diagrams"

Cohesion: 0.29
Nodes (8): GitHub Actions Only Deploy, Deploy Pipeline, deploy-preview-cleanup.yml, deploy-preview.yml, deploy-production.yml, Shared Preview Supabase DB, Sentry Observability, Supabase Postgres via Supavisor

### Community 43 - "Copy & Microcopy (pt-BR)"

Cohesion: 0.25
Nodes (8): IdentificationProvider Interface, Brand: Folhário / Meu Jardim, Confidence Display Guidelines, Do-Not-Say List (Jargon Avoidance), Copy & Microcopy Spec (pt-BR), Toxicity Disclaimer Text, pt-BR Locale Only at Launch, Honest AI (Confidence %, No Fake Numbers)

### Community 44 - "API Test Seed Helpers"

Cohesion: 0.43
Nodes (4): buildFakeAdapter(), makeDeletePhotoEntryRequest(), makeDeletePlantRequest(), makePatchRequest()

### Community 47 - "UX Goals & Core Loop"

Cohesion: 0.29
Nodes (7): WCAG 2.1 AA Baseline, Core Loop: Identify → Catalog → Care → Remind, <2 Min First Value Moment, WCAG 2.1 AA Accessibility, UX Goals, Contextual Push Permission (First Reminder Only), No Dark Patterns (Cancel/Delete)

### Community 50 - "SW Callback Engine"

Cohesion: 0.67
Nodes (4): formatCurrencyBRL(), formatDate(), formatDateTime(), formatTime()

### Community 56 - "Photo Journal Tests"

Cohesion: 0.6
Nodes (3): listLocations(), normalizeLabel(), GET()

### Community 57 - "Add Plant Form"

Cohesion: 0.83
Nodes (3): collectContextFiles(), collectFiles(), findOffenders()

### Community 70 - "Lightbox Component"

Cohesion: 0.5
Nodes (4): Dark Theme Palette: near-black background (~#1a1610), light cream heading text, muted body text, sage-green CTA button with dark text, Light Theme Palette: cream/off-white background, dark forest green heading, muted grey body, dark green CTA button with white text, Offline Screen — Dark Theme, Offline Screen — Light Theme

## Knowledge Gaps

- **87 isolated node(s):** `MockNetworkOnly`, `MockNetworkFirst`, `eo`, `ex`, `deploy-preview-cleanup.yml` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `eq` connect `E2E Test Infrastructure` to `SW Cache Engine`, `IAM Application Layer`, `Auth Middleware & Idempotency`, `Auth Login UI`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `deletePhotoEntry()` connect `Auth Middleware & Idempotency` to `Storage Adapter Layer`, `App Shell & Layouts`, `E2E Test Infrastructure`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `useSubscription()` connect `Profile & Analytics` to `Storage Cleanup Tests`, `SW Cache Activation`, `Async Jobs & Inngest`, `Accessibility Spec`, `Plant Photo Upload`, `Journal Add Sheet Tests`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 26 inferred relationships involving `errorResponse()` (e.g. with `deletePlantHandler()` and `patchPlantHandler()`) actually correct?**
  _`errorResponse()` has 26 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `CAVE-PRD Folhário MVP` (e.g. with `PRD v1.1 (Superseded)` and `Acceptance Criteria (Superseded)`) actually correct?**
  _`CAVE-PRD Folhário MVP` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `eq` (e.g. with `deletePhotoEntry()` and `list()`) actually correct?**
  _`eq` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `withUnitOfWork()` (e.g. with `updatePlant()` and `createPlant()`) actually correct?**
  _`withUnitOfWork()` has 9 INFERRED edges - model-reasoned connections that need verification._
