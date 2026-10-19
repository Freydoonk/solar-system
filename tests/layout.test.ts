import test from "node:test";
import assert from "node:assert/strict";
import { getOrbitGuides, getPositions } from "../src/components/solar-system/astronomy.ts";
import { createSceneLayout, moonOrbitRadius, planetOrbitRadius, projectMoon, projectPlanet } from "../src/components/solar-system/layout.ts";
import { AU_KM, BODY_PRESETS, SUN_MARKER_RADIUS_PX } from "../src/components/solar-system/planets.ts";

const guides = getOrbitGuides(2026);
const planets = BODY_PRESETS.filter((body) => !body.parentId);
const moons = BODY_PRESETS.filter((body) => body.parentId);

test("planet systems cannot overlap even when aligned at their nearest orbital edges", () => {
  for (const extent of [90, 110, 250, 600]) {
    for (const bodyScale of [0.5, 1, 3]) {
      for (const mode of ["true", "readable"] as const) {
        for (const zoom of [0.5, 1, 4]) {
          const layout = createSceneLayout(guides, extent, bodyScale, mode, zoom);
          let previousOuterEdge = SUN_MARKER_RADIUS_PX;
          for (const planet of planets) {
            // Includes all possible phases of the planet AND every one of its moons.
            const innerEdge = planetOrbitRadius(planet.id, 0, layout) - layout.systemRadii[planet.id];
            const outerEdge = planetOrbitRadius(planet.id, Number.MAX_VALUE, layout) + layout.systemRadii[planet.id];
            assert.ok(innerEdge > previousOuterEdge, `${planet.id}: extent ${extent}, size ${bodyScale}, ${mode}, zoom ${zoom}`);
            previousOuterEdge = outerEdge;
          }
          if (zoom === 1) assert.ok(previousOuterEdge <= extent + 1e-8, "Fit includes all satellite systems");
        }
      }
    }
  }
});

test("satellite discs, locator rings and orbital guides stay clear of parents and sibling moons", () => {
  for (const bodyScale of [0.5, 1, 3]) {
    const layout = createSceneLayout(guides, 250, bodyScale, "true", 1);
    for (const planet of planets) {
      let previousEdge = Math.max(layout.bodyRadii[planet.id], layout.locatorRadius);
      const satellites = moons.filter((body) => body.parentId === planet.id).sort((a, b) => a.semiMajorKm - b.semiMajorKm);
      for (const moon of satellites) {
        const envelope = Math.max(layout.bodyRadii[moon.id], layout.locatorRadius);
        const innerEdge = moonOrbitRadius(moon.id, 0, layout) - envelope;
        const outerEdge = moonOrbitRadius(moon.id, Number.MAX_VALUE, layout) + envelope;
        const guideRadius = moonOrbitRadius(moon.id, moon.semiMajorKm / AU_KM, layout);
        assert.ok(innerEdge > previousEdge, moon.id);
        assert.ok(guideRadius > innerEdge && guideRadius < outerEdge, moon.id);
        assert.ok(outerEdge <= layout.systemRadii[planet.id] + 1e-8, moon.id);
        previousEdge = outerEdge;
      }
    }
  }
});

test("Earth's Moon cannot reach Mercury, Venus or Mars orbits", () => {
  const layout = createSceneLayout(guides, 110, 3, "true", 0.5);
  const lunarExtent = moonOrbitRadius("moon", Number.MAX_VALUE, layout) + layout.bodyRadii.moon;
  const innerMoonEdge = planetOrbitRadius("earth", 0, layout) - lunarExtent;
  const outerMoonEdge = planetOrbitRadius("earth", Number.MAX_VALUE, layout) + lunarExtent;
  for (const id of ["mercury", "venus"]) {
    assert.ok(innerMoonEdge > planetOrbitRadius(id, Number.MAX_VALUE, layout), id);
  }
  assert.ok(outerMoonEdge < planetOrbitRadius("mars", 0, layout));
});

test("historical positions and date jumps remain separated, including Jupiter/Saturn alignment", () => {
  const layout = createSceneLayout(guides, 250, 1, "true", 1);
  for (const date of ["1900-01-01", "2000-01-01", "2020-12-21", "2024-04-08", "2026-10-19", "2100-12-31"]) {
    const positions = getPositions(new Date(`${date}T12:00:00Z`));
    const displayed = Object.fromEntries(planets.map((planet) => [planet.id, projectPlanet(planet.id, positions[planet.id], layout)]));
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const a = planets[i].id;
        const b = planets[j].id;
        const distance = Math.hypot(displayed[a].x - displayed[b].x, displayed[a].y - displayed[b].y);
        assert.ok(distance > layout.systemRadii[a] + layout.systemRadii[b], `${a}/${b} on ${date}`);
      }
    }
    for (const moon of moons) {
      const offset = projectMoon(moon.id, positions[moon.id], layout);
      assert.ok(Math.hypot(offset.x, offset.y) + layout.bodyRadii[moon.id] <= layout.systemRadii[moon.parentId!] + 1e-8);
    }
  }
});

test("zoom preserves relative body sizes, lunar clearances and astronomical directions", () => {
  const positions = getPositions(new Date("2026-10-19T00:00:00Z"));
  const normal = createSceneLayout(guides, 250, 1, "true", 1);
  const enlarged = createSceneLayout(guides, 250, 1, "true", 4);
  for (const body of BODY_PRESETS) {
    assert.ok(Math.abs(enlarged.bodyRadii[body.id] / normal.bodyRadii[body.id] - 4) < 1e-10);
    const position = positions[body.id];
    const point = body.parentId ? projectMoon(body.id, position, enlarged) : projectPlanet(body.id, position, enlarged);
    // Screen Y is inverted, but ecliptic longitude must be unchanged.
    assert.ok(Math.abs(Math.atan2(-point.y, point.x) - Math.atan2(position.y, position.x)) < 1e-10);
  }
  const moon = projectMoon("moon", positions.moon, normal);
  const bigMoon = projectMoon("moon", positions.moon, enlarged);
  assert.ok(Math.abs(Math.hypot(bigMoon.x, bigMoon.y) / Math.hypot(moon.x, moon.y) - 4) < 1e-10);
});
