# Project: Dopis Mobile Flutter Application

## Architecture
The Dopis mobile application is a production-grade Flutter client running on Android, Chrome Web, and Windows Desktop. It connects to the Astro backend REST APIs via HTTP with Bearer token authentication and replicates the exact web application design language.

### Core Architecture Layers:
1. **Presentation Layer (`lib/screens/`, `lib/widgets/`)**:
   - `LoginScreen`: Centered layout, Dopis vector logo, German headline, credentials form, discreet server URL dialog.
   - `MailListScreen`: Top app bar (brand, active account, sync, logout), horizontal folder pill tabs, responsive email stream tiles.
   - `EmailDetailScreen`: Back navigation (`← Zurück`), quick action toolbar (Star, Archive, Trash, Read/Unread), sender card, sanitized body reader, and Dopis AI Summary card (`✦ KI-Zusammenfassung`).
2. **State Management (`lib/providers/`)**:
   - `AuthProvider`: Manages authentication state, token storage, user info, login/logout transitions.
   - `MailProvider`: Manages mailbox folders, active folder stream, email detail cache, unread counters, optimistic flag updates, and AI analysis cache.
3. **Data & Services Layer (`lib/services/`, `lib/models/`)**:
   - `ApiService`: Interacts with Astro backend endpoints (`/api/auth/login`, `/api/emails`, `/api/email`, `/api/flags`, `/api/archive`, `/api/trash`, `/api/ai/analyze`) using `Authorization: Bearer <token>`.
   - `StorageService`: Persistent key-value storage for session tokens, server URL, and account details using `SharedPreferences`.
   - `Models`: `EmailSummary`, `EmailDetail`, `AiAnalysisResult`, `ActionItem`, `UserSession`.
4. **Design System & Theme (`lib/theme/`)**:
   - `AppTheme`: Global Material 3 theme incorporating Poppins typography, Dopis Blue (`#3661A4`), Slate text (`#0F172A`), card surface (`#FFFFFF`), page background (`#F8FAFC`), subtle borders (`#E2E8F0`), and minimum 48dp touch targets.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Project Scaffolding | Generate Flutter multiplatform project (`android`, `web`, `windows`) with clean structure | M1 | Survey (Flutter Env) |
| 2 | Dependency Configuration | Configure `pubspec.yaml` with `http`, `provider`, `shared_preferences`, `intl`, `google_fonts`, `flutter_svg` | M1 | Survey (Flutter Env) |
| 3 | Data Models | Models for `EmailSummary`, `EmailDetail`, `AiAnalysis`, `UserSession` with JSON serialization | M1 | Survey (Backend/Web) |
| 4 | Storage Service | Persistent session management (token, server URL, email, host) via SharedPreferences | M1 | Survey (Flutter Env) |
| 5 | API Client (Auth & Core) | HTTP client supporting Bearer auth, custom baseUrl, error mapping, and `POST /api/auth/login` | M1 | Survey (Backend API) |
| 6 | Discreet Server URL Config | Secondary dialog or drawer to adjust backend URL without cluttering the main consumer UI | M1 | ORIGINAL_REQUEST R1 |
| 7 | Login Header & Logo | Centered Dopis vector logo (viewBox 0 0 100 48) and headline `"IMAP-Zugangsdaten eingeben"` in `#3661A4` | M1 | Survey (Web UI) |
| 8 | Login Form & Error Banner | Form fields (Email, Password, Host `imap.ionos.de`, Port `993`), error banner in `#FEE2E2`/`#991B1B`, submit button `"Mit Postfach verbinden"` | M1 | Survey (Web UI) |
| 9 | Mail Top Bar | Header with "Dopis" brand title, "D" avatar badge, connected email label, sync button, and `"Abmelden"` sign-out | M2 | Survey (Web UI) |
| 10 | Folder Navigation Tabs | Horizontal scrollable pill tabs for German folders (`"Posteingang"`, `"Gesendet"`, `"Archiv"`, `"Papierkorb"`) with active `#3661A4` state | M2 | ORIGINAL_REQUEST R2 |
| 11 | Unread Badge Counters | Display count of unread messages next to folder pill and on unread list items | M2 | Survey (Web UI) |
| 12 | Email List View & Pull-to-Refresh | List displaying emails from `GET /api/emails?folder=...` with pull-to-refresh and empty state | M2 | ORIGINAL_REQUEST R2 |
| 13 | Unread vs Read Item Styling | Unread items highlighted with `#2563EB` dot indicator, bold sender/subject, soft tint; read items with clean white surface and `#E2E8F0` border | M2 | ORIGINAL_REQUEST R2 |
| 14 | Initial Avatars | 11-color palette initials hashing for senders | M2 | Survey (Web UI) |
| 15 | Formatted German Dates | Date display: `"HH:mm"` (today), `"d. MMM"` (current year), `"dd.MM.yyyy"` (prior years) | M2 | Survey (Web UI) |
| 16 | Starred Indicator | Amber star icon (`#FBBF24`) or `"★ Markiert"` badge on flagged items | M2 | ORIGINAL_REQUEST R2 |
| 17 | Detail View Navigation & Header | Back navigation button (`"← Zurück"`) and sender card with avatar, name, address, timestamp | M3 | ORIGINAL_REQUEST R3 |
| 18 | Quick Action Toolbar | Action buttons for Star/Unstar, Archive (`/api/archive`), Trash (`/api/trash`), Mark Read/Unread (`/api/flags`) | M3 | ORIGINAL_REQUEST R3 |
| 19 | Sanitized Email Body | Clean rendering of email body (HTML or formatted plain text) with line breaks and comfortable reading scale | M3 | ORIGINAL_REQUEST R3 |
| 20 | Dopis AI Summary Card | Card displaying `"✦ KI-Zusammenfassung"`, trigger button `"Mit KI analysieren"`, category badge, tag chips, bulleted summaries | M3 | ORIGINAL_REQUEST R3 |
| 21 | Interactive Action Items | AI-extracted action checklist under `"Aufgaben & Handlungsbedarf"` with checkmark toggling | M3 | Survey (Web UI) |
| 22 | Poppins Typography & Theming | Universal Poppins typography, exact colors (`#3661A4`, `#F8FAFC`, `#FFFFFF`, `#0F172A`, `#E2E8F0`) | M4 | ORIGINAL_REQUEST R4 |
| 23 | Small-Screen Optimization | Ergonomics for 360 x 640 dp viewport, minimum 48dp touch targets, zero RenderFlex overflow | M4 | ORIGINAL_REQUEST R4 |
| 24 | Automated E2E Test Suite | Opaque-box test suite (Tiers 1-4) covering all features, boundaries, combinations, and application workflows | E2E Track | Dual Track Requirement |
| 25 | Adversarial Coverage Hardening | Tier 5 white-box stress testing, chaos testing, and regression hardening | M-Final | Dual Track Requirement |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Scaffolding, Models, Storage & Auth | Scaffold project, dependencies, core models, storage service, API client login, Login screen (R1) | none | DONE |
| M2 | Mailbox Stream & Folder Navigation | MailProvider, top bar, German folder tabs, responsive email stream tiles, unread styling, avatar hashing, pull-to-refresh (R2) | M1 | DONE |
| M3 | Email Detail, Quick Actions & AI Summary | Email reading view, back nav, quick actions (Star, Archive, Trash, Read/Unread), body reader, AI summary card (R3) | M2 | DONE |
| M4 | UI/UX Fidelity, Poppins & Small-Screen Ergonomics | AppTheme, Poppins typography, color palette, 48dp touch targets, 360dp compact viewport validation (R4) | M3 | DONE |
| M-Final | 100% E2E Pass & Adversarial Hardening | Pass 100% E2E tests (Tiers 1-4) + Tier 5 Adversarial Coverage Hardening | M4, E2E Track | DONE |
| E2E | E2E Testing Suite (Dual Track) | Design & implement opaque-box test runner and test cases (Tiers 1-4); publish TEST_READY.md | M1 | DONE |

---

## Interface Contracts

### `ApiService` ↔ `Astro Backend`
- Base URL: `http://192.168.178.20:4321` (configurable; fallback `http://localhost:4321` or `http://10.0.2.2:4321`).
- Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.
- `POST /api/auth/login`:
  - Body: `{ "email": string, "password": string, "host": string, "port": int, "secure": bool }`
  - Response: `{ "success": true, "token": string, "expiresAt": string, "user": { "email": string, "host": string } }`
- `GET /api/emails?folder=<folder>`:
  - Response: `{ "account": string, "folder": string, "mailbox": string, "msgs": [...], "emails": [...] }`
- `GET /api/email?id=<seq>&folder=<folder>`:
  - Response: `EmailDetail` with headers, HTML, text, flags, attachments.
- `POST /api/flags`:
  - Body: `{ "seq": int, "seen"?: bool, "flagged"?: bool, "folder"?: string }`
  - Response: `{ "success": true, "seq": int, "seen": bool, "flagged": bool }`
- `POST /api/archive`:
  - Body: `{ "seq": int, "folder"?: string }`
  - Response: `{ "success": true, "moved": true, "seq": int, "destination": string }`
- `POST /api/trash`:
  - Body: `{ "seq": int, "folder"?: string, "permanent"?: bool }`
  - Response: `{ "success": true, "movedTo"?: string, "deleted"?: bool, "seq": int }`
- `POST /api/ai/analyze`:
  - Body: `{ "subject"?: string, "from"?: string, "text"?: string, "html"?: string }`
  - Response: `{ "summary": string[], "category": string, "tags": string[], "actionItems": ActionItem[], "paymentInfo": map, "orderInfo": map }`

### `AuthProvider` ↔ `Presentation Layer`
- Methods: `Future<bool> login(email, password, host, port, {baseUrl})`, `Future<void> logout()`, `Future<bool> tryAutoLogin()`.
- Properties: `bool isAuthenticated`, `UserSession? session`, `String? errorMessage`, `bool isLoading`, `String baseUrl`.

### `MailProvider` ↔ `Presentation Layer`
- Methods: `Future<void> fetchEmails({String? folder})`, `Future<EmailDetail?> fetchEmailDetail(int seq, String folder)`, `Future<void> toggleStar(int seq, String folder)`, `Future<void> toggleRead(int seq, String folder)`, `Future<void> archiveEmail(int seq, String folder)`, `Future<void> trashEmail(int seq, String folder, {bool permanent})`, `Future<AiAnalysisResult?> triggerAiAnalysis(EmailDetail email)`.
- Properties: `List<EmailSummary> emails`, `String currentFolder`, `bool isLoading`, `int unreadCount`, `Map<int, EmailDetail> detailsCache`, `Map<int, AiAnalysisResult> aiCache`.

---

## Code Layout
```
apps/mobile_flutter/
├── pubspec.yaml
├── assets/
│   └── icons/
│       └── logo.svg
├── lib/
│   ├── main.dart
│   ├── models/
│   │   ├── email_summary.dart
│   │   ├── email_detail.dart
│   │   ├── ai_analysis.dart
│   │   └── user_session.dart
│   ├── services/
│   │   ├── api_service.dart
│   │   └── storage_service.dart
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   └── mail_provider.dart
│   ├── screens/
│   │   ├── login_screen.dart
│   │   ├── mail_list_screen.dart
│   │   └── email_detail_screen.dart
│   ├── widgets/
│   │   ├── dopis_logo.dart
│   │   ├── folder_pills.dart
│   │   ├── email_tile.dart
│   │   ├── ai_summary_card.dart
│   │   └── sender_avatar.dart
│   └── theme/
│       └── app_theme.dart
└── test/
    ├── unit/
    │   ├── api_service_test.dart
    │   ├── models_test.dart
    │   └── providers_test.dart
    ├── widget/
    │   ├── login_screen_test.dart
    │   ├── mail_list_screen_test.dart
    │   └── email_detail_screen_test.dart
    └── e2e/
        ├── test_runner.dart
        ├── tier1_feature_test.dart
        ├── tier2_boundary_test.dart
        ├── tier3_pairwise_test.dart
        └── tier4_workload_test.dart
```
