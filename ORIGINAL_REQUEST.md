# Original User Request

## Initial Request — 2026-09-03T14:34:32+02:00

Build a production-grade Flutter mobile application for Dopis that replicates the web application's design language (pure white and signature Dopis blue `#3661A4`, German localization, high readability and touch ergonomics on small smartphone displays) and connects to the existing Astro backend REST APIs.

Working directory: c:\Users\Nico\Documents\Programming\Astro\dopis\apps\mobile_flutter
Integrity mode: development

## Requirements

### R1. Authentication & IMAP Connection
Provide a clean login screen modeled after `apps/web/src/pages/login.astro`:
- Centered layout displaying the original Dopis logo.
- Headline: "IMAP-Zugangsdaten eingeben".
- Input fields for Username/Email (`name@domain.de`), Password, IMAP Host (`imap.ionos.de`), and Port (`993`).
- Primary action button "Mit Postfach verbinden".
- Securely authenticate via `POST /api/auth/login` on the Dopis backend and persist the authentication session locally.
- Keep server URL configuration discreet (defaulting to the local/network host) so it does not clutter the standard user login experience.

### R2. Mailbox Stream & Folder Navigation
Provide a responsive mailbox list view matching the web application (`apps/web/src/components/Mail.jsx` and `MailList.jsx`):
- Top bar showing "Dopis", the active email account, a refresh button, and a sign-out ("Abmelden") option.
- Horizontal pill tabs for German folders: "Posteingang", "Gesendet", "Archiv", "Papierkorb".
- Clean email list items:
  - Unread items: Highlighted blue border and soft tint, unread badge, bold sender and subject.
  - Read items: Clean white surface with subtle borders.
  - Avatared initials with brand coloring.
  - Formatted dates, subject lines, snippet previews, and starred badges ("★ Markiert").
- Pull-to-refresh / on-demand reload support.

### R3. Email Detail Reading & Quick Actions
Provide a comprehensive email reading view:
- Navigation bar with back navigation ("← Zurück") and quick action buttons (Star/Unstar, Archive, Trash).
- Header card with sender avatar, sender name, address, and timestamp.
- Dopis AI summary card ("✦ KI-Zusammenfassung") allowing the user to trigger concise email summarization and action items via the AI endpoint.
- Sanitized, readable email body view formatted for smartphone screens with comfortable font sizes and line heights.

### R4. UI/UX Fidelity & Small-Screen Optimization
- Typography: Poppins font family across all screens.
- Color Palette:
  - Primary Brand Blue: `#3661A4`
  - Page Background: `#F8FAFC`
  - Card & Input Surfaces: `#FFFFFF`
  - High-Contrast Body Text: `#0F172A` / `#1E293B`
  - Subtle Borders: `#E2E8F0`
- Touch targets: Minimum 46–48dp for all inputs and buttons.
- Responsive layout preventing text truncation, overflow errors, or layout clipping on compact viewports (e.g. 360 x 640 dp).

## Verification Resources
- Astro Web Backend running on `http://192.168.178.20:4321` or `http://localhost:4321` providing endpoints `/api/auth/login`, `/api/emails`, `/api/emails/:id`, `/api/emails/:id/flags`, `/api/emails/:id/move`, and `/api/ai/analyze`.
- Reference implementations in `apps/web/src/pages/login.astro`, `apps/web/src/components/Mail.jsx`, and `packages/shared/src/api-client.ts`.
- Flutter 3.41 / Dart 3.11 SDK environment with Chrome, Windows Desktop, and Android Emulator (`Pixel_8_API_35`) targets.

## Acceptance Criteria

### Code Quality & Compilation
- [ ] `flutter analyze` passes with zero errors and zero fatal warnings.
- [ ] `flutter build web` or `flutter build bundle` completes successfully.

### Functional Integrity
- [ ] Submitting valid credentials authenticates against the backend and transitions to the mailbox screen.
- [ ] Selecting different folders ("Posteingang", "Gesendet", "Archiv", "Papierkorb") fetches and displays the respective email list.
- [ ] Tapping an email opens the detail screen with complete sender metadata, subject, and readable body.
- [ ] Star, Archive, and Trash action buttons update the email status and propagate changes back to the mailbox list.
- [ ] Triggering the AI summary card generates and displays a summary without crashing or UI freezing.

### Visual & Ergonomic Verification
- [ ] Login screen visual elements (logo, headline, inputs, button) match `login.astro` styling without unwanted container boxes or prominent developer URLs.
- [ ] The app renders cleanly without any overflow stripes (RenderFlex overflow) when tested at 360px mobile width.
