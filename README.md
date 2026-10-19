# Solar System

A React / TypeScript solar-system explorer with a shared simulation clock, date-based planetary positions, Moon phases and astronomical seasons.

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

- The Gregorian calendar and UTC time input select a moment between 1900 and 2100. Editing either pauses the simulation. **Play** continues from that moment, **Reset** returns to the last selected moment, and **Now** selects the current time.
- **Time speed** specifies simulated Earth time per real second. All planets, moons, the calendar, Moon phase and seasons use the same timestamp. Background tabs do not accumulate a time jump.
- **True proportions** is the default size mode. Planets and moons use one kilometres-to-pixels factor. A shared screen-fit and zoom factor preserves these ratios. Tiny hollow locator rings are annotations, not body surfaces.
- The Sun is a small, fixed position marker by default. **Show Sun at true size** displays its full disc at the planets' scale without shrinking the planets or changing their positions. Enabling this also selects **True proportions**; switching to illustrative sizes restores the Sun marker. The full Sun can overlap the compressed orbits.
- **Enlarged small bodies** is an explicitly illustrative alternative that makes small objects easier to see; its relative sizes are compressed.
- Orbital spacing is illustrative: each planet and its entire satellite system receives a separate radial band. Bands reserve enough room for all orbital phases, body discs and locator rings; Moon orbits cannot cross neighbouring planetary tracks. Satellite tracks also remain clear of their parent and sibling moons. Bands remain reserved when moons are hidden.
- **Zoom** replaces the old independent **Distance** slider. It enlarges bodies and orbital spacing together, preserving clearances. Drag the sky or focus it and use arrow keys to pan; **Fit system** recentres the view and shows all systems. The size control preserves relative body sizes and recalculates the space needed by each system.
- The lower-right Earth panel shows the illuminated lunar disc and fraction, and the opposite astronomical seasons in both hemispheres. Its northern/southern view selector rotates the Moon illustration; orientation in a local observer's sky also depends on location and time.

## Astronomy model

[Astronomy Engine](https://github.com/cosinekitty/astronomy/tree/master/source/js) calculates heliocentric planet positions (including Pluto), Earth's Moon, and the four Galilean moons. The view preserves their longitudes in the J2000 ecliptic plane, viewed from its north pole. Radial distances are remapped into separate illustrative bands, including a separate band for Pluto; real orbit intersections are not represented in this overview. Motion is calculated from the date rather than arbitrary animation periods. This is an educational diagram, not an observer's sky chart or an eclipse renderer.

Moon illumination comes from the geocentric Sun–Earth–Moon geometry. Season boundaries use each year's calculated equinoxes and solstices, not fixed calendar dates. Orbital guides are sampled trajectories; satellite circles indicate mean orbit sizes and do not represent their full inclinations or eccentricities.

Phobos, Deimos, Titan, Enceladus, Titania and Triton retain schematic circular paths, with physical mean periods and retrograde motion for Triton. Their starting phases and orbital planes are illustrative, not historical ephemerides. These moons carry an asterisk in the interface. Selecting a date gives calculated positions for the planets, Earth's Moon and Galilean moons, while these other satellite positions remain schematic.

Physical data sources:

- [JPL planetary mean radii and periods](https://ssd.jpl.nasa.gov/planets/phys_par.html)
- [JPL satellite mean radii](https://ssd.jpl.nasa.gov/sats/phys_par/)
- [JPL satellite mean orbital elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html)

The automated tests cover physical size ratios, date validation and leap years, clock progression, a J2000 Earth reference position, relative orbital rates, known 2024 lunar phases, Moon graphic geometry, and season transitions. Layout tests cover worst-case planetary alignment, satellite clearances, the Moon staying between neighbouring planetary tracks, screen fitting and zoom across body-size settings and viewport sizes. Reference events use [NASA's lunar phase tables](https://eclipse.gsfc.nasa.gov/phase/phase2001gmt.html) and [USNO's astronomical seasons](https://aa.usno.navy.mil/data/Earth_Seasons).
