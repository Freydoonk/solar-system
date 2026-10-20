# Solar System

A React / TypeScript solar-system explorer with an interactive Three.js 3D view, a shared simulation clock, date-based planetary positions, Moon phases and astronomical seasons. A 2D overview remains available.

## Run

Use Node.js 25, matching the project's Docker images and deployment workflow.

```sh
npm ci
npm run dev
npm test
npm run build
```

The application is served under `/solar-system/`. `npm run lint` also checks the source; the unrelated `Ball.tsx` component currently has one existing hook dependency warning.

### Docker development

```sh
docker compose up -d --build
```

Open `http://localhost:5173/solar-system/`. The development service runs `npm ci` before Vite starts so its separate `/app/node_modules` volume matches the mounted `package-lock.json`. After adding or updating a dependency while the container is running, run `docker compose restart web`. Installing packages on the host alone does not update this volume. If dependency installation fails, inspect `docker compose logs web`; Vite starts only after installation succeeds.

`.dockerignore` keeps the host's `node_modules` out of Linux images. Production images install locked dependencies during the build; rebuild them after dependency changes.

## GitHub Pages

This repository already includes [the deployment workflow](.github/workflows/deploy.yml). Vite's `base` is `/solar-system/`, matching the repository name.

1. Open [Settings → Pages](https://github.com/Freydoonk/solar-system/settings/pages).
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Commit your changes and push the `main` branch. The **Deploy to GitHub Pages** workflow installs the locked dependencies, runs tests, builds `dist`, and publishes it. You can also start it from **Actions → Deploy to GitHub Pages → Run workflow** after the desired commit is on GitHub.
4. When deployment succeeds, the site is available at **https://freydoonk.github.io/solar-system/**. The workflow's deployment link is the authoritative URL.

No Docker server or backend is required on Pages. Images, fonts, JavaScript chunks and textures are included in the build. Do not commit `node_modules` or `dist`. For a fork with a different repository name, change `base` in `vite.config.ts` to `/<repository-name>/`; for a root `username.github.io` site or a custom domain, use `/`.

To check the production build locally: `npm run build`, then `npm run preview`, and open `http://localhost:4173/solar-system/`.

References: [Vite's Pages guide](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Controls

- **Help**, above the sky, opens the in-app guide for camera movement, touch, time travel and display conventions. Press **Esc** or **Close** to dismiss it.
- **3D explorer** opens centered on Earth, with its diameter occupying 15% of the sky viewport's shorter side. Only the camera distance changes; physical size and distance ratios remain intact. Switching directly to 2D uses the same initial framing. **Fit system** shows the whole solar system; **Recenter** or selecting a body gives a closer view.
- **Follow body** selects any planet, moon or the Sun. **Sun in view** locks the camera angle to keep the selected body and the Sun in the frame, mainly showing the body's night side. If a moon's parent blocks either sight line, the camera moves farther away; all physical geometry stays unchanged. A locator marks the Sun when it is smaller than a few pixels. **Free angle** follows the body's orbital motion while allowing manual viewing angles.
- Moons also offer **From [planet]** and **Behind moon · [planet] in view**. The first starts just outside the parent's physical radius/ring envelope on the moon-facing side and looks at the moon. Wheel zoom approaches the moon along that line, with a limit that prevents backing into the planet or rings; **Recenter** returns to the planet. This viewpoint follows the planet–moon direction, not a fixed surface location. The second looks from behind the moon toward its parent and fits the planet's entire disc/ring envelope in portrait or landscape. Both follow orbital motion and date changes at true scale; tiny moons retain a locator. Manual camera movement releases these angle locks too.
- Earth also has **My region**. On page load, a single HTTPS lookup through [GeoJS](https://www.geojs.io/docs/v1/endpoints/geo/) estimates the visitor's region from their public IP. The camera faces that region and follows Earth's terrestrial rotation and orbital movement, including date jumps. Wheel zoom keeps either angle lock. Dragging, touch gestures, focused arrow keys, **Release angle lock**, Top / Side or switching to 2D releases it. Choose a follow mode again to re-enable it. A late location response never overrides a manually adjusted view.
- Location is approximate; a VPN or mobile network can identify a different region. The lookup requests no GPS access and sends no cookies or referrer. Only rounded coordinates and a city/country label are held in memory; this app does not store the IP or location. GeoJS receives the normal request IP. Offline, blocked, invalid or timed-out lookups leave the normal Earth view available after a maximum four-second lookup wait; rendering starts immediately. The location service is the only external runtime request; textures and other assets remain bundled.
- Left-drag to orbit; hold **Space before left-dragging** to move left/right/up/down in the screen plane. Release Space to return to the chosen mode on the next drag. Select **Pan** under **Drag action**, or use right-drag. Select **Orbit** to rotate again. Scroll to approach/retreat. Touch: one finger follows the chosen Orbit/Pan mode, two fingers zoom/pan. Click or Tab into the sky to pan with arrow keys. Space shortcuts apply only while the sky is focused or hovered with no control focused, so fields and buttons retain their normal behaviour. Browser Ctrl/Cmd wheel shortcuts remain available.
- Click a body or its label, or choose it under **Follow body**, to fly to it and follow its movement. This includes every moon, even bodies too small to select in the overview. Camera framing follows date jumps too. **Recenter** restores the selected follow mode; **Top**, **Side**, and **Fit system** restore useful camera positions. Selecting a moon enables moon visibility; hiding moons while following one returns to its parent.
- On phones and small tablets, **Camera**, **Time**, and **Moon & seasons** select the controls below the sky. This panel scrolls independently. Short landscape screens put it beside the sky. Controls have larger touch targets, and the layout accounts for display cutouts and the home indicator. The compact following badge leaves the center of the sky clear.
- In the whole-system view, wheel zoom moves toward the pointer. When following a body, zoom stays centered on that body so you can examine its surface. The 3D camera can approach far more closely than the 2D zoom slider. Reduced-motion preferences disable camera flights.
- The Gregorian calendar and UTC time input select a moment between 1900 and 2100. Editing either pauses the simulation. **Play** continues from that moment, **Reset** returns to the last selected moment, and **Now** selects the current time.
- **Time speed** defaults to **Real time**, one simulated second per real second. All planets, moons, the calendar, Moon phase and seasons use the same timestamp. Background tabs do not accumulate a time jump.
- **Both views always use true sizes and distances.** One scene unit equals 1,000,000 km. The Sun, every planet, every moon, heliocentric distances and parent-relative satellite distances all use this exact same conversion. There are no independent size/distance controls, enlarged-body modes, orbit bands or Sun-size toggles.
- The Sun is always a physical sphere/disc at the same scale as the other bodies. Actual orbital separations keep the planets and moons outside it. Hollow locator rings and labels are annotations only; they never enlarge a body's surface.
- At true scale, most bodies are smaller than a pixel in the whole-system view. **Follow body** and **Recenter** work in both views and bring even tiny moons into view. **Fit system** restores the overview. Perspective in 3D and foreshortening in the top-down 2D projection affect apparent sizes/separations as expected.
- In **2D overview**, the single **Zoom** control multiplies both radii and distances together. Scroll toward the pointer or use the logarithmic slider, which spans 0.5×–10 billion× to reach small moons from the full solar system. Drag or use arrow keys to pan. A selected body stays centered as the simulation runs. Scrolling over the controls panel keeps its normal behaviour.
- The lower-right Earth panel shows the illuminated lunar disc and fraction, and the opposite astronomical seasons in both hemispheres. Its northern/southern view selector rotates the Moon illustration; orientation in a local observer's sky also depends on location and time.

## Astronomy model

[Astronomy Engine](https://github.com/cosinekitty/astronomy/tree/master/source/js) calculates heliocentric planet positions (including Pluto), Earth's Moon, and the four Galilean moons. Both views use the same physical scene: AU coordinates are converted to kilometres, then divided by the common scale. The 3D view retains all three J2000 ecliptic coordinates; 2D is their orthographic projection from ecliptic north. No logarithmic or per-orbit remapping is applied. Eccentricity, inclination and interplanetary distance ratios are preserved. Projected orbit lines can cross, including Pluto/Neptune, without a physical collision. Motion is calculated from the date rather than arbitrary animation periods. This is an educational model, not an observer's sky chart or an eclipse renderer.

Moon illumination in the Earth panel comes from geocentric Sun–Earth–Moon geometry. Season boundaries use each year's calculated equinoxes and solstices, not fixed calendar dates. Planetary guides are sampled trajectories. Satellite guides are illustrative circles at the current physical orbital radius, tilted to pass through each satellite's position; they are not full historical trajectories. The Earth panel supplies the astronomical lunar phase.

For example, Earth's mean orbital distance divided by the Sun's radius is approximately 215; the mean Earth–Moon distance divided by Earth's radius is approximately 60.3. These ratios are invariant under zoom in both views. In the model the Sun's radius is 0.6957 units, Earth's radius is about 0.006371 units and 1 AU is 149.5978707 units.

The 3D renderer subtracts a nearby origin in double precision and applies a common render-only unit conversion to **all** geometry, camera distances and clipping planes. This maintains numerical detail when approaching tiny moons without changing any physical ratios or historical positions.

Phobos, Deimos, Titan, Enceladus, Titania and Triton retain schematic circular paths, with physical mean periods and retrograde motion for Triton. Their starting phases and orbital planes are illustrative, not historical ephemerides. These moons carry an asterisk in the interface. Selecting a date gives calculated positions for the planets, Earth's Moon and Galilean moons, while these other satellite positions remain schematic.

Physical data sources:

- [JPL planetary mean radii and periods](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL satellite mean radii](https://ssd.jpl.nasa.gov/sats/phys_par/)
- [JPL satellite mean orbital elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html)

## 3D appearance and assets

The Sun lights textured spheres with visible day/night sides. Earth has a separate cloud layer, an atmospheric rim and night lights that fade on the day side. Earth's day, night and cloud maps are aligned to Greenwich using Astronomy Engine's [terrestrial observer vectors](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md#ObserverVector), including sidereal time, precession and nutation. Its geographic day/night boundary follows the selected UTC moment, including **Now**. Saturn has textured rings; Uranus has a faint illustrative ring. The smaller Martian moons have irregular shapes. Planet/Moon pole directions and spin rates use Astronomy Engine's IAU model and the shared simulation clock; texture prime-meridian alignment for bodies other than Earth remains illustrative.

Surface maps by [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/) are bundled locally under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). There is no runtime dependency on the texture host. See [asset attribution](public/textures/ATTRIBUTION.md). Pluto and satellite surfaces other than Earth's Moon are deterministic artistic approximations, not observed maps. Static cloud/surface maps do not reproduce weather or historical surface changes. Lighting exposure, atmospheric rims, irregular moon shapes and ring appearance remain illustrative; the body scales use mean physical radii. This is not a photometric or eclipse simulation.

The renderer is loaded separately from the controls. WebGL initialization/context errors offer a **2D view** fallback. GPU resources, controls, observers and animation loops are disposed when switching away from 3D.

The automated tests cover physical size/distance ratios in both views, Sun clearance across sampled orbits from 1900–2100, unchanged moon-parent distances, date validation, clock progression, relative orbital rates, lunar phases and seasons. View tests cover orbit shape/inclination, fitting every body (including tiny moons), shared scaling through zoom/resizes, pointer anchoring, camera following across date jumps, numerical rendering precision and rotation axes/rates. Earth lighting tests transform the actual textured mesh normals and compare their solar altitudes with the separate observer/horizon calculation, including Britain by day/night, other longitudes, polar regions, seasons, UK daylight-saving transition dates and years 1900–2100. Navigation tests exercise real OrbitControls with synthetic input: four-direction Space-pan, return to orbit, persistent Pan mode, right-drag/arrow keys, form focus, and shortcut cleanup after lost focus or unmount. Reference events use [NASA's lunar phase tables](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html) and [USNO's astronomical seasons](https://aa.usno.navy.mil/data/Earth_Seasons).
