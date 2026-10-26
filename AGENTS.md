# Project guide for coding agents

Read this file first. It applies to the whole repository. Use the map below to read the files and tests relevant to the current task; do not scan the entire codebase by default. Inspect the implementation before changing it: this guide is an index and a record of design decisions, not a substitute for source code.

Keep this guide current when architecture, important behaviour, file ownership or commands change. Keep user-facing feature descriptions in [README.md](README.md). Do not turn this file into a session log or copy entire implementations into it.

## Project and runtime

Solar System is a browser-only React 19 / TypeScript / Vite application using Three.js and Astronomy Engine. There is no backend, account system, telescope hardware connection or persistent planner database. Dependencies and exact versions are in [package.json](package.json) and [package-lock.json](package-lock.json). Use Node.js 25, matching Docker and CI.

- `#explore`: physical-scale 3D solar system, 2D overview, following cameras, time controls, Moon phase and seasons.
- `#observe`: location-based telescope pointing, observing windows, sky directions, 3D eyepiece previews and a telescope catalogue.
- PWA: installation, offline assets/calculations and an explicit update action.
- Product text is currently English; user conversations may be Persian. Do not infer that a request in Persian is a request to translate the interface.

## Entry points and data flow

[src/main.tsx](src/main.tsx) mounts [src/App.tsx](src/App.tsx). App manages hash navigation and installation UI. It keeps Explore mounted and mounts Observe lazily on its first visit; visited pages retain their state while hidden. Their `active` prop stops clock/render work while hidden. There is no routing library or global state store.

Explore: `SolarSystem.tsx` owns the simulation timestamp, display settings and camera requests. `astronomy.ts` calculates positions/orientations and guides. `space.ts` converts physical coordinates to scene coordinates. `SpaceScene.tsx` renders 3D; `layout.ts` and `viewport.ts` support the 2D projection. `bodyVisuals.ts` creates shared textured meshes.

Observe: `Observe.tsx` owns an independent time, location, target and search state. `observing.ts` calculates coordinates and observing windows. `observing.worker.ts` runs window searches off the UI thread. `EyepiecePreview.tsx` owns telescope/accessory selections; `eyepiece.ts` calculates optics and observer-relative appearance; `EyepieceScene.tsx` draws the lazy, interactive 3D preview. `telescopes.ts` supplies catalogue data and instrument limitations.

Night planning: `TonightPlanner.tsx` presents `tonight.ts` session scheduling. `planning.worker.ts` and `usePlanning.ts` run cancellable calculations, reject stale results by request identity, and terminate work while hidden. Plans use ten-minute visits within a fixed budget and a rolling 24-hour search; tests are in `tonight.test.ts`.

## Where to work

Paths in the first column are relative to the repository root. Start with the indicated files and their focused tests.

| Area | Main files | Relevant tests under `tests/` |
| --- | --- | --- |
| App navigation, install dialog | [App.tsx](src/App.tsx), [App.css](src/App.css) | `pwa.test.ts` for worker behaviour; UI checks for navigation |
| Explore state, clock and controls | [SolarSystem.tsx](src/components/solar-system/SolarSystem.tsx) | `astronomy.test.ts`, `following.test.ts` |
| Physical body data and ephemerides | [planets.ts](src/components/solar-system/planets.ts), [astronomy.ts](src/components/solar-system/astronomy.ts) | `astronomy.test.ts`, `space.test.ts` |
| 3D coordinates, framing, renderer | [space.ts](src/components/solar-system/space.ts), [SpaceScene.tsx](src/components/solar-system/SpaceScene.tsx) | `space.test.ts`, `following.test.ts` |
| Surface maps, spin and day/night | [bodyVisuals.ts](src/components/solar-system/bodyVisuals.ts), `astronomy.ts` | `earth-lighting.test.ts`, `space.test.ts` |
| Follow modes and region lock | [following.ts](src/components/solar-system/following.ts), [locationView.ts](src/components/solar-system/locationView.ts) | `following.test.ts`, `location-view.test.ts` |
| Mouse, touch, Space-pan, cursor | [navigation.ts](src/components/solar-system/navigation.ts), `SpaceScene.tsx` | `navigation.test.ts` |
| 2D scale, zoom and pan | [layout.ts](src/components/solar-system/layout.ts), [viewport.ts](src/components/solar-system/viewport.ts), [Planet.tsx](src/components/solar-system/Planet.tsx), [Sun.tsx](src/components/solar-system/Sun.tsx) | `layout.test.ts`, `viewport.test.ts` |
| Explore mobile panels and help | [SolarSystem.module.css](src/components/solar-system/SolarSystem.module.css), [ControlsHelp.tsx](src/components/solar-system/ControlsHelp.tsx), `SolarSystem.tsx` | Portrait/landscape and mouse/touch UI checks |
| Shared approximate location | [location.ts](src/components/solar-system/location.ts) | `location.test.ts` |
| Observe UI, precise/manual location | [Observe.tsx](src/components/observing/Observe.tsx), [Observe.module.css](src/components/observing/Observe.module.css) | `observing.test.ts`; permission/manual-entry UI checks |
| Pointing, dates and search worker | [observing.ts](src/components/observing/observing.ts), [observing.worker.ts](src/components/observing/observing.worker.ts) | `observing.test.ts` |
| Eyepiece optics and 3D preview | [eyepiece.ts](src/components/observing/eyepiece.ts), [EyepiecePreview.tsx](src/components/observing/EyepiecePreview.tsx), [EyepieceScene.tsx](src/components/observing/EyepieceScene.tsx), [preview CSS](src/components/observing/EyepiecePreview.module.css) | `eyepiece.test.ts` |
| Telescope models and capabilities | [telescopes.ts](src/components/observing/telescopes.ts) | `eyepiece.test.ts` |
| Install/offline/update lifecycle | [pwa.ts](src/pwa.ts), [manifest](public/manifest.webmanifest), [build-pwa.mjs](scripts/build-pwa.mjs), [service-worker.mjs](scripts/service-worker.mjs) | `pwa.test.ts` |
| Deployment and Docker | [Vite config](vite.config.ts), [Pages workflow](.github/workflows/deploy.yml), [Dockerfile](Dockerfile), [dev compose](docker-compose.yml), [prod compose](docker-compose.prod.yml) | Production build and subpath asset checks |

`src/components/ball/` is an unrelated component, not part of the current application flow. Do not read or modify it for solar-system features unless the task actually involves it.

## Behaviour and invariants to preserve

### Explore

- One physical scale for **all radii and distances**, in both 2D and 3D: one scene unit is 1,000,000 km. The Sun is also physical-scale. Never reintroduce separate size/distance multipliers, exaggerated moon orbits or a minimum visible body radius. Labels/locator rings are annotations. Change camera framing to make a body visible.
- `astronomy.ts` positions use AU and the J2000 ecliptic frame; planets are heliocentric and moon positions are parent-relative. `space.ts` converts to scene units and maps `(x, y, z)` to `(x, z, -y)`. Avoid mixing these with Observe's equatorial/observer frame. Render-origin rebasing and render scale apply uniformly to geometry, distances and clipping planes.
- All Explore bodies, dates, phases and seasons share one timestamp, supported from 1900 through 2100. Initial speed is real time. Initial Earth diameter is 15% of the viewport's shorter side. Date editing pauses the simulation; inactive/background time does not accumulate a jump.
- Astronomy Engine supplies planet, Moon and Galilean-moon ephemerides. Other configured moons have explicitly schematic paths (`schematic` in body data); do not present them as historical ephemerides. Projected orbit lines can cross without a physical collision.
- Earth textures and lighting must stay aligned to real geographic coordinates and time. Preserve the Earth observer-vector orientation and day/night regression tests. Other texture longitude alignment and static weather remain illustrative.
- Follow modes include free angle, Sun in view, Earth's My region, and moon views from/behind the parent relationship. Manual rotation/pan releases automatic angle locks; ordinary wheel zoom preserves them. Late IP results must not override manual camera movement. Follow requests use serial numbers to distinguish intentional reselection.
- Orbit controls stop when released; Fine control reduces sensitivity. Space-pan must not intercept form shortcuts. Dragging shows a closed hand, resets after cancellation/lost focus, and must not accidentally select a body. Mobile controls initially collapse to preserve sky space.

### Observe and instrument previews

- Observe has its own clock and target/site state; do not silently couple it to Explore. Times are device timezone or UTC, independent of chosen location. Reject invalid dates and skipped daylight-saving times. UTC entry disambiguates repeated local times.
- Azimuth is clockwise from **true north**; altitude is above the horizon. RA/Dec can be equator-of-date or J2000. Keep observer-relative positions, refraction choices and coordinate epochs explicit.
- Observing windows require geometric target-centre altitude at least 20° and Sun altitude at most −6°. Search event boundaries and valid maxima; handle polar/circumpolar cases without invented rise/set events. Preserve worker cancellation and the displayed search start time.
- Direction lookup covers the listed planets and Moon within a 10° cone; it is not an eyepiece field or a star catalogue. Exclude solar pointing. Weather, buildings, seeing and mount alignment are not predicted.
- The eyepiece view preserves disc-to-field angular ratios, including subpixel targets and clipping. The enlarged 3D inspector is labelled as a different scale/viewpoint; returning restores the observer view. Optical inputs must be finite and valid. Example equipment/accessory assumptions must remain visible.
- Amateur telescope presets apply sourced native aperture/focal length. Editing those returns to Custom; accessory edits retain the model. Professional/space profiles describe scientific instruments, not consumer-eyepiece or camera-exposure simulations, and do not move the observer's site. Keep target exclusions explicit.
- Reuse bundled meshes/textures and credit them. The preview is not a photometric, diffraction, weather or eclipse simulation. Do not imply its texture detail will be visible through a particular instrument. Verify new telescope specifications against official sources and link them in the catalogue.

### Location, rendering and offline behaviour

- Explore and Observe share one cached-in-memory GeoJS lookup. Device geolocation requires the user's explicit button action; manual entry remains available. Precise/manual coordinates stay in tab memory. Do not persist them, send them to another service or cache location responses. Late asynchronous results must respect subsequent manual choices.
- Hidden pages retain state but should not do unnecessary clock/render work. Ignore zero-size resize events. Dispose Three.js resources, observers, event handlers and workers on cleanup; accommodate React Strict Mode. The eyepiece renderer draws on changes/interactions rather than a continuous loop.
- Preserve WebGL/texture error handling. Explore offers a 2D fallback; Observe retains numerical guidance if 3D fails. Test small portrait and short landscape layouts when changing controls.
- Production service-worker assets are generated after Vite builds, including lazy page/render chunks, the observing worker and textures. Keep URLs relative to the app base/scope. Cache only bundled app assets. Updates wait for normal lifecycle activation or an explicit Update action; do not force unexpected reloads.
- [Texture attribution](public/textures/ATTRIBUTION.md) documents Solar System Scope / INOVE maps and CC BY 4.0. Preserve attribution when changing/reusing assets. Do not edit generated `dist/` or commit `node_modules/`.

## Commands and validation

```sh
npm ci
npm run dev
npm test
node --test tests/eyepiece.test.ts
npm run lint
npm run build
npm run preview
```

The single-file test command is an example; select relevant tests from the map. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. Native Node tests run TypeScript through Node 25's type stripping; there is no Jest/Vitest setup. Keep calculation helpers independent of React/browser globals so they can be tested directly.

For code changes, run relevant tests, lint and a production build; broaden tests when shared astronomy, coordinates, navigation or offline behaviour changes. Check UI changes at desktop/mobile sizes when browser tools are available, and report any unverified behaviour. Documentation-only edits need link/path and diff checks, not a full application test run. The existing unrelated lint warning is `Ball.tsx`'s missing `startPhysics` hook dependency; do not suppress new diagnostics on that basis.

Vite serves `/solar-system/`: development usually uses port 5173, preview 4173. `npm run build` includes the PWA `postbuild` script; running only `vite build` omits that step. Test install/offline/update behaviour against the production preview on localhost or HTTPS, not the dev server. A large Three.js chunk warning alone is not a build failure.

Docker development has a separate `/app/node_modules` volume. The startup command runs `npm ci`; after dependency changes, restart the service so the volume matches the lockfile. Host-side installation alone does not update it. The Pages workflow runs tests/build and publishes `dist` on pushes to `main`; keep its repository subpath consistent with Vite and PWA paths.

Last reviewed against the implementation: 2026-10-26. Update the relevant sections when behaviour changes instead of relying on old chat history.
