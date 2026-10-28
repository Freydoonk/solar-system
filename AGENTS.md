# Project guide for coding agents

Read this file first. It applies to the whole repository. Use the map below to read the files and tests relevant to the current task; do not scan the entire codebase by default. Inspect the implementation before changing it: this guide is an index and a record of design decisions, not a substitute for source code.

Keep this guide current when architecture, important behaviour, file ownership or commands change. Keep user-facing feature descriptions in [README.md](README.md). Do not turn this file into a session log or copy entire implementations into it.

Writing convention: Never use the em dash character (Unicode U+2014) in interface text, documentation, comments or assistant responses. Use a comma, colon or parentheses as appropriate, and use "to" for time ranges. Preserve this preference in future changes.

## Project and runtime

Solar System is a browser-only React 19 / TypeScript / Vite application using Three.js and Astronomy Engine. There is no backend, account system or telescope hardware connection. Explicit notebook actions persist notes/targets/equipment locally; location and planner clocks remain in tab memory. Dependencies and exact versions are in [package.json](package.json) and [package-lock.json](package-lock.json). Use Node.js 25, matching Docker and CI.

- `#explore`: physical-scale 3D solar system, 2D overview, following cameras, time controls, Moon phase and seasons.
- `#observe`: location-based telescope pointing, observing windows, sky directions, 3D eyepiece previews and a telescope catalogue.
- `#sky`: live observer-centered 3D sky, phone orientation, drag/keyboard fallback and constellation labels.
- `#learn`: lazy guided lessons with an independent shared lesson clock and paired space/Earth diagrams.
- PWA: installation, offline assets/calculations and an explicit update action.
- Product text supports English, Persian, Arabic, Spanish and French through `src/i18n/`. The compact flag selector saves only the language preference. Persian and Arabic use RTL layout; astronomical diagrams retain their physical coordinate directions. Fonts are bundled locally: Inter, Vazirmatn and Noto Sans Arabic.

## Entry points and data flow

[src/main.tsx](src/main.tsx) mounts [src/App.tsx](src/App.tsx). App manages hash navigation and installation UI. It keeps Explore mounted and mounts Observe lazily on its first visit; visited pages retain their state while hidden. Their `active` prop stops clock/render work while hidden. There is no routing library or global state store.

Sky also mounts lazily on first visit. App owns `useObserverLocation.ts`, shared by Observe and Sky, including the site-bound horizon mask and async location-choice identity. `LocationControls.tsx` provides explicit device/manual entry. Neither site nor horizon persists. Explore and this hook share the cached startup resolver in `location.ts`: previously granted geolocation permission uses the device, otherwise the shared coarse lookup is used without prompting. `Sky.tsx` owns an always-live clock, display settings and north alignment; `skyViewModel.ts` reuses atlas/pointing coordinates once per minute. `SkyScene.tsx` draws the local sky sphere on demand (east +X, up +Y, north -Z), with symbolic markers and clipped constellation lines. This frame is separate from Explore's physical scene.

Sky computes a separate geometric, topocentric Sun position without adding it to Observe's `TARGETS`. Its gold disc/halo is an annotation clipped by the same horizon mask. Show Sun centers the manual camera and stops motion tracking; below-horizon or obstructed status remains available when the marker is hidden. `sky-motion.test.ts` covers solar positions, camera centering and horizon clipping as well as the continued exclusion of telescope solar targets.

Sky defaults to a dark map with all enabled object guides. Its compact Display menu independently controls stars, planets, Moon, Sun, constellations, Messier objects, labels and compass directions, plus Match daylight and reset. Choices remain in tab memory across page/language changes. `skyDisplay.ts` shares visibility policy between markers and the center readout; the Moon is independent of other planets. Messier objects default off. Show Sun explicitly enables its layer. Match daylight fades night markers/labels between Sun altitudes -12° and 0° and hides them in daylight; enabled Sun, Moon and compass markers remain. Both modes share live positions and the clock. This is an illustrative clear sky, not photometry or weather prediction.

`skyOrientation.ts` converts W3C Z-X-Y device rotations and screen orientation to the rear-facing camera; relative alpha is never assumed to reference north. `useSkyMotion.ts` requests permission only from the enable button, prefers absolute events, validates samples, coalesces rendering and rejects late permission results. Relative-only sensors require explicit true-north alignment. Hidden/inactive Sky removes sensor listeners and releases its renderer; motion must be re-enabled on return. Dragging switches to manual control. WebGL failures retain a numerical direction readout and suggest the 2D atlas. `sky-motion.test.ts` checks cardinal directions, pitch, both landscape orientations, calibration/wrap, invalid data, camera projection and sky/horizon agreement.

Learn follows the same lazy first-visit/state-retention pattern. `src/components/learning/Learn.tsx` owns lesson selection/playback; `lessons.ts` supplies ephemeris-derived geometry and checkpoints, tested in `lessons.test.ts`. Its diagrams use explicitly labelled annotation/plot conventions and must not alter Explore's physical scale or either other page's clock. Mobile navigation uses two header rows; Explore reads the shared header-height variable.

Explore: `SolarSystem.tsx` owns the simulation timestamp, display settings and camera requests. `astronomy.ts` calculates positions/orientations and guides. `space.ts` converts physical coordinates to scene coordinates. `SpaceScene.tsx` renders 3D; `layout.ts` and `viewport.ts` support the 2D projection. `bodyVisuals.ts` creates shared textured meshes.

Observe: `Observe.tsx` owns an independent time, location, target and search state. `observing.ts` calculates coordinates and observing windows. `observing.worker.ts` runs window searches off the UI thread. `EyepiecePreview.tsx` owns telescope/accessory selections; `eyepiece.ts` calculates optics and observer-relative appearance; `EyepieceScene.tsx` draws the lazy, interactive 3D preview. `telescopes.ts` supplies catalogue data and instrument limitations.

Night planning: `TonightPlanner.tsx` presents `tonight.ts` session scheduling. `planning.worker.ts` and `usePlanning.ts` run cancellable calculations, reject stale results by request identity, and terminate work while hidden. Plans use ten-minute visits within a fixed budget and a rolling 24-hour search; tests are in `tonight.test.ts`.

`PlanningWorkspace.tsx` retains planning-tab state. `NightChartPanel.tsx` / `nightChart.ts` provide worker-sampled geometric altitude curves; chart interaction updates only Observe's time. `night-chart.test.ts` checks samples against the pointing model and date bounds. All new calculation workers are included by the existing PWA asset discovery.

`EventCalendar.tsx` / `events.ts` search phases, oppositions (heliocentric relative longitude **0°** for outer planets), greatest elongations and lunar eclipses in the planning worker. Eclipse local status refers only to peak, not the whole event. ICS export uses UTC, escapes/folds RFC 5545 text and omits site data. Validate with `events.test.ts`.

`SkyAtlasPanel.tsx` is lazy and projects the bundled `catalogue/` only while active, once per minute. `skyAtlas.ts` applies HYG Cartesian space motion then J2000-to-equator-of-date rotation; no stellar annual aberration/parallax or refraction. Atlas constellation lines/Messier markers are finding annotations, separate from planet pointing and eyepiece simulation. `sky-atlas.test.ts` checks catalogue integrity, reference positions and spherical horizon geometry. `scripts/build-sky-catalogue.mjs` is an explicit network maintenance command, not a build/runtime dependency. Preserve `public/catalogue/` attribution and licences when updating data.

`NotebookPanel.tsx`, `notebook.ts` and `useNotebook.ts` own validated version-1 local records. Observe owns the hook and shares it with planning tools and `EyepiecePreview` for explicit setup save/load. Writes occur on user actions, never on location/clock changes. Strict field whitelists omit coordinate metadata from imported/exported records; free-text notes remain user-authored. Storage failures retain exportable tab state; imports merge without replacing existing IDs, and one-step undo restores the previous notebook. `notebook.test.ts` covers validation, merge, limits and metadata exclusion.

Observe's tool workspace displays one panel at a time. `PlanningWorkspace` receives the controlled tool selection; Pointing, Eyepiece, Observing times and Find by direction are direct peers of the planning tools, with no nested telescope tab bar. Their target and retained state are shared. Location/time editing uses a native modal drawer, and the summary/navigation stay separate from variable-height results. Hidden tools receive inactive props. Keep mobile navigation horizontally scrollable rather than packing all panels into a changing grid.

`HorizonEditor.tsx` / `horizon.ts` define eight piecewise-linear obstruction heights at true-north 45° bearings. Observe ties the in-memory mask to the current site identity. `observing.ts` first finds exact geometric altitude/twilight windows, then applies 30-second sampled mask crossings refined to 0.1 seconds; very narrow/grazing clearances may be missed. Best times remain inside the clipped intervals. Validate masks, wrap north, and preserve the clear-horizon result exactly (`horizon.test.ts`). Night plans, pointing, event status and atlas overlays share the mask.

`FieldMode.tsx` is a full-viewport native dialog with red controls, adjustable content brightness and large target navigation. Opening it explicitly selects live Observe time; scheduled visit previews are clearly marked and never silently replace live time. Session targets are tied to site/horizon identity and stay in tab memory. The underlying workspace/renderer pauses while the dialog is open; the live clock also skips background-tab updates. Closing restores focus and scrolling. The app cannot recolor browser/system UI or change device brightness.

## Where to work

Paths in the first column are relative to the repository root. Start with the indicated files and their focused tests.

| Area | Main files | Relevant tests under `tests/` |
| --- | --- | --- |
| App navigation, install dialog | [App.tsx](src/App.tsx), [App.css](src/App.css) | `pwa.test.ts` for worker behaviour; UI checks for navigation |
| Languages, fonts, RTL and translation coverage | [languages.ts](src/i18n/languages.ts), [messages.ts](src/i18n/messages.ts), [fonts.css](src/fonts.css), [translation audit](scripts/check-i18n.mjs) | `i18n.test.ts`, `ui-state.test.ts`; desktop/mobile visual checks |
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
| Live sky and phone motion | [Sky.tsx](src/components/observing/Sky.tsx), [SkyScene.tsx](src/components/observing/SkyScene.tsx), [skyOrientation.ts](src/components/observing/skyOrientation.ts), [useSkyMotion.ts](src/components/observing/useSkyMotion.ts), [useObserverLocation.ts](src/components/observing/useObserverLocation.ts) | `sky-motion.test.ts`, `sky-atlas.test.ts`, `location.test.ts`; permission and responsive UI checks |
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
- The original direction lookup covers the listed planets and Moon within a 10° cone; it is not an eyepiece field. The separate Star atlas adds a bundled star/Messier catalogue. Exclude solar pointing. Weather, buildings, seeing and mount alignment are not predicted.
- The eyepiece view preserves disc-to-field angular ratios, including subpixel targets and clipping. The enlarged 3D inspector is labelled as a different scale/viewpoint; returning restores the observer view. Optical inputs must be finite and valid. Example equipment/accessory assumptions must remain visible.
- Amateur telescope presets apply sourced native aperture/focal length. Editing those returns to Custom; accessory edits retain the model. Professional/space profiles describe scientific instruments, not consumer-eyepiece or camera-exposure simulations, and do not move the observer's site. Keep target exclusions explicit.
- Reuse bundled meshes/textures and credit them. The preview is not a photometric, diffraction, weather or eclipse simulation. Do not imply its texture detail will be visible through a particular instrument. Verify new telescope specifications against official sources and link them in the catalogue.

### Location, rendering and offline behaviour

- Explore, Observe and Sky share one cached-in-memory startup location result. Query existing geolocation permission first (bounded to one second); `granted` automatically requests high-accuracy device coordinates with a 15-second timeout. Prompt/denied/unsupported/failed queries or device errors use the shared GeoJS fallback. Never trigger a new permission prompt on startup. The explicit device button can request permission; manual entry remains available. Precise/manual coordinates stay in tab memory. Do not persist them, send them to another service or cache location responses. IP requests use `no-store`, omit credentials and referrer. Late asynchronous results must respect subsequent manual choices and unmounts.
- Hidden pages retain state but should not do unnecessary clock/render work. Ignore zero-size resize events. Dispose Three.js resources, observers, event handlers and workers on cleanup; accommodate React Strict Mode. The eyepiece renderer draws on changes/interactions rather than a continuous loop.
- Preserve WebGL/texture error handling. Explore offers a 2D fallback; Observe retains numerical guidance if 3D fails. Test small portrait and short landscape layouts when changing controls.
- Production service-worker assets are generated after Vite builds, including lazy page/render chunks, the observing worker and textures. Keep URLs relative to the app base/scope. Cache only bundled app assets. Updates wait for normal lifecycle activation or an explicit Update action; do not force unexpected reloads.
- [Texture attribution](public/textures/ATTRIBUTION.md) documents Solar System Scope / INOVE maps and CC BY 4.0. Preserve attribution when changing/reusing assets. Do not edit generated `dist/` or commit `node_modules/`.

## Commands and validation

### Translation maintenance rule

- Every added, edited or removed user-facing message must update **all registered language catalogues in the same change**. This includes buttons, placeholders, tooltips, accessible labels, errors/status messages, lessons, telescope descriptions, chart/Three.js labels and generated calendar descriptions. No new hardcoded interface prose, partial English fallback or TODO translations.
- Use `t()` from `src/i18n/messages.ts` at the presentation boundary. English source messages are stable catalogue keys in `en.json`; each other JSON file has the exact same keys. Prefer whole sentences with named placeholders; preserve the exact placeholder set in every translation. Use `Translated` for React element slots instead of HTML injection. Pure calculations and workers keep language-independent IDs/data; `format.ts` supports optional translators for exports and generated descriptions.
- Do not translate user-authored notebook content, external location names, URLs, catalogue IDs or equipment identifiers. International stellar names may retain their established spelling. Search should match translated labels as well as original names/IDs. Language changes must not reset clocks, coordinates, targets, equipment or display choices; refresh imperative canvas/Three.js labels too.
- To add a language, provide its complete JSON catalogue and register its native label, locale, direction and bundled flag in `languages.ts`. Add a local font subset only if needed, with its licence/attribution. Keep astronomical dates Gregorian, and do not mirror chart coordinates for RTL. Only the language preference is persisted.
- Run `npm run check:i18n` and `npm test` before committing. The source audit rejects untranslated JSX/accessibility text and missing static/data messages; catalogue tests check complete key sets, nonempty values and interpolation slots. Review dynamic text paths as well, because arbitrary runtime strings cannot be fully checked statically. `ui-state.test.ts` uses jsdom and Vite to check language/state/location races with mocked 3D renderers, so it is not a substitute for visual RTL/mobile or hardware permission testing. Add translation coverage when introducing a new dynamic message source.

```sh
npm ci
npm run dev
npm test
npm run check:i18n
node --test tests/eyepiece.test.ts
npm run lint
npm run build
npm run preview
```

The single-file test command is an example; select relevant tests from the map. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. Native Node tests run TypeScript through Node 25's type stripping; there is no Jest/Vitest setup. Keep calculation helpers independent of React/browser globals so they can be tested directly.

For code changes, run relevant tests, lint and a production build; broaden tests when shared astronomy, coordinates, navigation or offline behaviour changes. Check UI changes at desktop/mobile sizes when browser tools are available, and report any unverified behaviour. Documentation-only edits need link/path and diff checks, not a full application test run. Keep lint free of errors and warnings; do not suppress hook-dependency diagnostics.

Vite serves `/solar-system/`: development usually uses port 5173, preview 4173. `npm run build` includes the PWA `postbuild` script; running only `vite build` omits that step. Test install/offline/update behaviour against the production preview on localhost or HTTPS, not the dev server. A large Three.js chunk warning alone is not a build failure.

Docker development has a separate `/app/node_modules` volume. The startup command runs `npm ci`; after dependency changes, restart the service so the volume matches the lockfile. Host-side installation alone does not update it. The Pages workflow runs tests/build and publishes `dist` on pushes to `main`; keep its repository subpath consistent with Vite and PWA paths. Checkout/setup-node use v6; upload-pages-artifact/deploy-pages use v5, including a Node 24 upload-artifact dependency. These action runtimes are separate from the application's Node 25 toolchain.

Last reviewed against the implementation: 2026-10-28. Update the relevant sections when behaviour changes instead of relying on old chat history.
