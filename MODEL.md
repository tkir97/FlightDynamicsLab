# Current flight engine: JSBSim

The live simulator now runs JSBSim 1.2.4 via WebAssembly. It uses an experimental C172S approximation derived from upstream C172R data with a 180 hp engine and 2,550 lb initial loading. The following calibration describes the **retired custom engine**, not the active JSBSim model. Those performance-fit results must not be interpreted as validation of JSBSim. Fuel burn and mass/CG now evolve; flaps remain up and ground contact still ends the flight. See README.md and the app's engine/model sources page for current provenance and validation.

# Historical custom-engine Cessna 172S calibration

This is a performance-tuned clean-configuration approximation, not a measured six-degree-of-freedom aircraft database. Configuration: 2,550 lb gross weight, flaps up, speed fairings, standard atmosphere and zero wind. Mass/CG do not change during flight. Flaps and ground handling are not simulated.

## Sourced parameters

| Parameter | Model |
|---|---:|
| Gross weight | 2,550 lb / 1,156.66 kg |
| Wing area | 174 ft² / 16.165 m² |
| Wingspan | 36 ft 1 in / about 11 m |
| Rated engine power | 180 hp / 134.226 kW |
| Engine reference | Lycoming IO-360-L2A |
| Propeller reference | Fixed pitch, two blades, 76 in diameter |

Sources: [Cessna 172S Nav III information manual](https://calaero.edu/wp-content/uploads/2023/05/Cessna_172SP_NavIII_POH_opt.pdf), general specifications and sections 4–5; [Textron Skyhawk product card](https://cessna.txtav.com/-/media/cessna/files/product-cards/piston/skyhawk_product_card.pdf).

Inertia values of approximately 1,285 / 1,825 / 2,667 kg m² are proxies from the publicly documented [JSBSim C172P reference model](https://github.com/JSBSim-Team/jsbsim/blob/master/aircraft/c172x/c172x.xml), converted from 948 / 1346 / 1967 slug ft². These are not measured loaded-172S inertias. Tail/fin areas and arms also use that reference geometry as proxies. That retired custom engine incorporated no JSBSim code or aerodynamic tables.

## Fitted and estimated parameters

`dist/aircraft.mjs` holds the aircraft configuration. The wing lift multiplier, zero-lift drag, and speed-dependent propeller loss factor were fitted to the handbook stall, cruise and climb targets. Wing/tail surface locations relative to a fixed assumed CG, washout, dihedral, downwash, incidence, and control effectiveness remain engineering estimates. The wing polar in `dist/physics.mjs` is illustrative and is not measured 172S airfoil data.

The propeller uses an actuator-disk approximation plus a fitted loss factor. It does not solve RPM, manifold pressure, mixture, blade torque, P-factor, slipstream, or engine operating limits. The throttle slider controls the fraction of available shaft power, not a calibrated relationship between cockpit lever position and RPM. Available power falls with density. The separate engine-power reading is a percentage of sea-level rated power, so it differs from the throttle percentage at altitude.

## Acceptance results

These are calibration checks using the actual simulator force model. They are not independent flight-test validation. Cruise values are true airspeed at a specified percentage of rated engine power. The check solves zero acceleration/pitch moment rather than changing speed by fiat.

| Pressure altitude | Rated power | Handbook KTAS | Model KTAS |
|---|---:|---:|---:|
| Sea level | 55% | 101 | 100.3 |
| Sea level | 65% | 108 | 108.3 |
| Sea level | 75% | 114 | 115.0 |
| 4,000 ft | 55% | 104 | 103.4 |
| 4,000 ft | 65% | 112 | 111.9 |
| 4,000 ft | 75% | 119 | 119.1 |
| 8,000 ft | 55% | 107 | 106.6 |
| 8,000 ft | 65% | 117 | 115.7 |
| 8,000 ft | 75% | 124 | 123.3 |

Additional checks:

- Clean power-off stall target: 53 KCAS. The balanced-tail CLmax sweep gives 52.9 KEAS, effectively CAS at this sea-level reference. This is a quasi-steady estimate; it does not validate transient stall onset or recovery.
- Sea-level full-power climb target: 730 ft/min at 74 KIAS. A steady lift/drag/thrust balance predicts 734 ft/min. Climb speed uses the handbook clean-aircraft conversion of 74 KIAS to approximately 73.2 KCAS at sea level.
- Full-power sea-level maximum speed target: 126 KTAS; model: 128.3 KTAS.

The cruise targets come from the handbook's section 4 cruise-performance summary, not a particular tail number. Climb and stall references are section 5 standard-condition/gross-weight data. Detailed flight modes, spin behavior, crosswind handling and control forces have not been matched to measurements.

## Airspeed readings

The primary instrument displays calibrated airspeed (KCAS), computed from isentropic pitot impact pressure and ISA static pressure. True airspeed (KTAS) is displayed separately. This avoids comparing altitude-dependent TAS to the handbook's stall CAS. An indicated-airspeed gauge and its installation-specific position-error correction are not implemented.

Initial-condition speeds remain TAS and resetting solves a fresh wings-level cruise trim. Available selectable speeds are 87, 101 and 117 KTAS; the previous 126-knot cruise preset was removed because it may exceed available power at some altitudes with the 180 hp engine.

## Reproduce

Run `npm test` for 20 physical/numerical checks. `dist/performance.mjs` provides `cleanStall()`, `climbEstimate()`, `cruiseAtPower()`, and nine documented cruise targets. Browser CSV telemetry includes CAS and shaft power, in addition to flight state and aerodynamic forces.

## Cockpit view

The cockpit is a simplified analog 172-style visual model, independent of the 172S Nav III handbook used for performance calibration. It is not a faithful G1000 reproduction. Its airspeed instrument is explicitly calibrated airspeed rather than an indicated-airspeed installation model. Camera movement and cockpit drawing do not modify flight dynamics.

## Geographic imagery

The aircraft's local NED origin is placed at Cambridge Airport (EGSC), 52°12′18″ N, 000°10′30″ E. Reference: [NATS Cambridge aerodrome chart](https://www.aurora.nats.co.uk/htmlAIP/Publications/2024-11-28-AIRAC/graphics/402432.pdf). Terrain is a flat 14.3 m MSL approximation, not a digital elevation model. Local NED north/east map to Web Mercator at a fixed origin scale. The physics atmosphere still uses MSL altitude. This is suitable for a small local visual scene, not long-range geodetic navigation. Satellite imagery is external, attributed Esri World Imagery content, and is not a navigation chart or live weather feed.
