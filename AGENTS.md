# Goal

Build Open Timelog (时迹), an MIT licensed independent UpTimer alternative.
Use static package/code analysis as the reference. Do not control the official app
or read its user database, sessions or account data. Keep original assets separate.

# Current State

- Public own repo: https://github.com/AlexbeatsZ/open-timelog, main tracks origin/main.
- Public v0.1.0 is available; v0.2.0 builds verified; unified release publication in progress.
- React/TypeScript + IndexedDB; Electron Windows/macOS; Capacitor Android; offline PWA.
- v0.2 UI has exactly four main panels: latest-first card timeline, timer, goals, analysis.
  Idle cards allow record creation; records can fill upper/lower adjacent idle gaps.
  Timer activity selection starts immediately, stop saves and returns to timeline.
- System/light/dark appearance, Android system file picker, local authenticated desktop
  REST API and CLI implemented. API uses the same domain transactions as UI.
- Points remain statistics; no shop/reward UI or API. Legacy v1 backup fields retained.
- 18 domain tests and 9 Windows browser/desktop scenarios passed. Packaged Windows EXE
  separately passed restart persistence and authenticated API scenarios.
- macOS arm64 and x64 packaged on user's Mac, ad-hoc signature verified. Actual arm64
  packaged app passed restart persistence and API scenarios; Intel execution unverified.
- Android release signing materials exist only in ignored .local/, keep for future updates.
- No auto sync, official backup conversion, plans/workflows, countdown, notifications or iOS app.

# Active Work

- Android assembleRelease/lintRelease and APK signature verification passed.
- Package v0.2.0 source/web/Windows plus macOS/Android under one GitHub Release.
- Keep verification boundaries explicit: no Android physical touch/lifecycle acceptance,
  no Intel runtime acceptance, no Apple Developer ID signing/notarization.

# Build / Run / Test

- npm ci; npm run dev; npm run desktop.
- npm run check; npm test; npm run build; npm run test:e2e.
- npm run package:win; npm run package:mac (on macOS).
- node scripts/init-android-signing.mjs (first local signing key only); npm run package:android.
- Android needs existing JDK 21 and SDK 36; script prefers Android Studio JBR on Windows.
- Set process-local TIMELOG_PACKAGED_EXE to actual EXE/.app executable, then run
  npx playwright test -g 'desktop app|authenticated desktop API'. Tests use isolated profiles.
- Read docs/design/domain.md for persistence/time changes, interface.md for UX and timeline,
  platforms.md for theme, Android, macOS, API and import/file-picker contracts.

# Durable Lessons

- Persist timer timestamps; never derive duration from tick counts. Keep invalid storage
  intact and exportable instead of silently resetting it.
- Static hosts may add Vary: Origin; app-shell cache matching must ignore Vary.
- Electron runtime downloads on this Windows host require process-local ELECTRON_GET_USE_PROXY=1.
  Gradle needs explicit process-local Java proxy properties; don't alter global environments.
- macOS runtime download can stall; scripts/package.mjs supports TIMELOG_ELECTRON_ZIP_DIR
  with official electron-vVERSION-darwin-ARCH.zip files for offline packaging.
- Native file selection is asynchronous: backup before import and reject restore if data
  changed while selecting a file. Cancellation must not replace data.
- Timer note blur can precede the stop click; save pending note in the stop transaction.

# Docs Index

- docs/design/domain.md: timer, dates, scoring, storage and backup contracts.
- docs/design/interface.md: four panels, timeline gaps, fill semantics and visual system.
- docs/design/platforms.md: theme, mobile shell/files, desktop packaging and HTTP API.
- docs/research/uptimer.md: exact static reference evidence and unsupported parity.
- docs/api.md; public/openapi.json: AI integration, CLI and REST operations.
- docs/user-guide.md: user operation and migration.
