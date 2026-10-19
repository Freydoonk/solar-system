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

## Controls

- **3D explorer** opens by default. Left-drag to orbit the camera, scroll to approach/retreat, and right-drag to pan. Touch: one finger orbits, two fingers zoom/pan. Focus the canvas to pan with arrow keys. Browser Ctrl/Cmd wheel shortcuts remain available.
- Click a body or its label, or choose it under **Explore a body**, to fly to it and follow its movement. This includes every moon, even bodies too small to select in the overview. Zoom and orbit freely around the selected body. Camera framing follows date jumps too. **Recenter**, **Top**, **Side**, and **Fit system** restore useful camera positions. Selecting a moon enables moon visibility; hiding moons while following one returns to its parent.
- In the whole-system view, wheel zoom moves toward the pointer. When following a body, zoom stays centered on that body so you can examine its surface. The 3D camera can approach far more closely than the 2D zoom slider. Reduced-motion preferences disable camera flights.
- The Gregorian calendar and UTC time input select a moment between 1900 and 2100. Editing either pauses the simulation. **Play** continues from that moment, **Reset** returns to the last selected moment, and **Now** selects the current time.
- **Time speed** specifies simulated Earth time per real second. All planets, moons, the calendar, Moon phase and seasons use the same timestamp. Background tabs do not accumulate a time jump.
- **True proportions** is the default size mode. Planets and moons use one common size factor. Perspective in 3D changes their apparent screen sizes with camera distance. Tiny hollow locator rings are annotations, not body surfaces.
- The Sun is a small, fixed position marker by default. **Show Sun at true size** displays its full disc at the planets' scale without shrinking the planets or changing their positions. Enabling this also selects **True proportions**; switching to illustrative sizes restores the Sun marker. The full Sun can overlap the compressed orbits.
- **Enlarged small bodies** is an explicitly illustrative alternative that makes small objects easier to see; its relative sizes are compressed.
- Orbital spacing is illustrative: each planet and its entire satellite system receives a separate radial band. Bands reserve enough room for all orbital phases, body discs and locator rings; Moon orbits cannot cross neighbouring planetary tracks. The 3D bands also reserve room for Saturn's and Uranus's rings. Satellite tracks remain clear of their parent and sibling moons. Bands remain reserved when moons are hidden. Bodies can overlap in the camera's line of sight, as in any 3D scene, while staying physically separated in the display.
- In **2D overview**, **Zoom** enlarges bodies and orbital spacing together, preserving clearances. Scroll over the sky to zoom towards the pointer, or use the synchronised slider (0.5×–4×). Drag the sky or use arrow keys to pan; **Fit system** recentres the view. Scrolling over the controls panel keeps its normal behaviour. The size control preserves relative body sizes and recalculates the space needed by each system.
- The lower-right Earth panel shows the illuminated lunar disc and fraction, and the opposite astronomical seasons in both hemispheres. Its northern/southern view selector rotates the Moon illustration; orientation in a local observer's sky also depends on location and time.

## Astronomy model

[Astronomy Engine](https://github.com/cosinekitty/astronomy/tree/master/source/js) calculates heliocentric planet positions (including Pluto), Earth's Moon, and the four Galilean moons. The 3D view retains all three J2000 ecliptic coordinates, including orbital inclinations. Each planetary orbit receives a single uniform radial scale: this preserves its shape, eccentricity and a focus at the Sun while separating the planet's entire satellite system from its neighbours. Thus interplanetary distances are illustrative, and real intersections such as Pluto/Neptune are deliberately separated. Most planetary ellipses are close to circular; foreshortening also changes their appearance as the camera rotates. The 2D view retains its compact radial remapping and north-pole projection. Motion is calculated from the date rather than arbitrary animation periods. This is an educational diagram, not an observer's sky chart or an eclipse renderer.

Moon illumination in the Earth panel comes from geocentric Sun–Earth–Moon geometry. Season boundaries use each year's calculated equinoxes and solstices, not fixed calendar dates. Planetary guides are sampled trajectories. Satellite guides are illustrative circles, tilted to pass through each satellite's current position in 3D; they are not full historical trajectories. Enlarged satellite distances mean rendered lighting is an illustration; the Earth panel supplies the astronomical lunar phase.

Phobos, Deimos, Titan, Enceladus, Titania and Triton retain schematic circular paths, with physical mean periods and retrograde motion for Triton. Their starting phases and orbital planes are illustrative, not historical ephemerides. These moons carry an asterisk in the interface. Selecting a date gives calculated positions for the planets, Earth's Moon and Galilean moons, while these other satellite positions remain schematic.

Physical data sources:

- [JPL planetary mean radii and periods](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL satellite mean radii](https://ssd.jpl.nasa.gov/sats/phys_par/)
- [JPL satellite mean orbital elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html)

## 3D appearance and assets

The Sun lights textured spheres with visible day/night sides. Earth has a separate cloud layer, an atmospheric rim and night lights that fade on the day side. Saturn has textured rings; Uranus has a faint illustrative ring. The smaller Martian moons have irregular shapes. Planet/Moon pole directions and spin rates use Astronomy Engine's IAU model and the shared simulation clock; texture prime-meridian alignment is illustrative.

Surface maps by [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/) are bundled locally under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). There is no runtime dependency on the texture host. See [asset attribution](public/textures/ATTRIBUTION.md). Pluto and satellite surfaces other than Earth's Moon are deterministic artistic approximations, not observed maps. Static cloud/surface maps do not reproduce weather or historical surface changes. Sunlight intensity is kept readable across compressed distances; this is not a photometric or eclipse simulation.

The renderer is loaded separately from the controls. WebGL initialization/context errors offer a **2D view** fallback. GPU resources, controls, observers and animation loops are disposed when switching away from 3D.

The automated tests cover physical size ratios, date validation and leap years, clock progression, a J2000 Earth reference position, relative orbital rates, known 2024 lunar phases, Moon graphic geometry, and season transitions. Layout tests cover worst-case planetary alignment, satellite/ring clearances, the Moon staying between neighbouring planetary tracks, screen fitting and pointer-anchored zoom. 3D tests verify orbit shape and inclination preservation, camera framing in portrait/landscape, following every body across a date jump, and rotation axes/rates. Reference events use [NASA's lunar phase tables](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html) and [USNO's astronomical seasons](https://aa.usno.navy.mil/data/Earth_Seasons).
