# Goal

Build Open Timelog (时迹), an MIT licensed, independent UpTimer alternative.
Reference the official application's observable features and offline package
metadata. Keep the official installation, sessions and user data untouched.
Deliver a working Windows desktop app and responsive offline web app first.

# Current State

- v0.1.0 implemented; no dependency on the retired private `uptimer` experiment.
- Public repository: `https://github.com/AlexbeatsZ/open-timelog`;
  `origin` uses HTTPS, branch `main`. Publication work records live in `docs/log/`.
- Public release: `https://github.com/AlexbeatsZ/open-timelog/releases/tag/v0.1.0`;
  source tag points to `34cde01`. Windows ZIP, static web ZIP and guide uploaded.
- GitHub tag CI passed; anonymous repository/release/Windows-download checks
  returned HTTP 200. Local user deliverables remain under the chat's `outputs/`.
- Stack: React + TypeScript + Vite, IndexedDB, Electron desktop wrapper.
- Activities, durable timer, records/tags/search, daily timeline, 7/30-day
  analytics, daily/weekly goals, points/rewards, JSON merge/restore and exports
  are implemented. No account, telemetry or remote service is required.
- `release/Open Timelog-win32-x64/Open Timelog.exe` is the Windows portable app.
- 13 domain tests and 7 browser/desktop scenarios passed on 2026-10-19.
- No automatic sync, official backup compatibility, plans/workflows,
  notifications, countdown or native Android APK yet. See the parity matrix.
- All source is independently written. Official code, icons, fonts and assets
  must not be copied into the implementation or distribution.

# Active Work

- v0.1.0 implementation, Windows packaging and public Release are complete.
  Keep source, release tags and public documentation aligned on future updates.
- Next candidates: editable day calendar, split/merge records, countdown;
  then plans/workflows and separately designed self-hosted sync.

# Build / Run / Test

- `npm install`; `npm run dev` (loopback only).
- `npm run check`; `npm test`; `npm run build`.
- `npm run desktop`; `npm run package:win`.
- `npm run test:e2e` exercises isolated browser/desktop data only.
- For the packaged app test, set process-local `TIMELOG_PACKAGED_EXE` to its
  absolute EXE path and run `npx playwright test -g "Windows desktop app"`.
- Read `docs/design/domain.md` before changing timer, date, scoring or imports.

# Durable Lessons

- Timer duration derives from persisted timestamps, never interval tick counts.
- Preserve original invalid storage on a load error; never silently reset it.
- Do not connect to the official service or assume its backup format.
- Static hosts may add `Vary: Origin`; cache lookup for immutable local app
  assets must ignore Vary, or offline module/style requests can miss the cache.
- First Electron download on this host needs process-local
  `ELECTRON_GET_USE_PROXY=1` to honor its existing HTTP(S) proxy configuration.
- `@electron/packager` 20 exports named `packager`, without a default export.

# Docs Index

- `docs/design/domain.md`: time, persistence, points and import contracts.
- `docs/design/interface.md`: interaction and visual choices.
- `docs/research/uptimer.md`: references, local package evidence and parity.
- `docs/user-guide.md`: end-user operation, backup, migration and deployment.
