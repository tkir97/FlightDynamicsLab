# Flight Dynamics Lab — local export

Unzip the archive, then open a terminal in the extracted `flight-dynamics-lab` folder.

## Start

Python 3 is the only requirement for the included server. No npm install or build is needed.

macOS / Linux:

```sh
python3 run_local.py
```

Windows:

```powershell
py run_local.py
```

Open http://localhost:8000 in a modern browser. Press Ctrl+C in the terminal to stop.
If port 8000 is busy, add `--port 8080` and open http://localhost:8080 instead.

## Use your own server

Serve the `dist` folder as the web root. ES modules (`.mjs`) must be served as JavaScript and
`.wasm` as `application/wasm`. The files must be opened through HTTP; double-clicking
`index.html` will not load module workers reliably. The included server sets these MIME types.
The single-threaded JSBSim WASM build does not require cross-origin isolation headers.

## Included

All shipped simulator assets, JSBSim WASM and aircraft/engine data, the optimized 737 cockpit,
licenses and corresponding engine source, evidence report and response traces. Editable
JavaScript source, test files and report-generation scripts are included too.

Satellite map tiles are fetched from Esri and require internet access. Flight dynamics and
bundled cockpit assets are local. The F-15 remains an evidence-informed approximation,
not a flight-data-validated F-15C model. See `README.md` and `dist/validation/f15.html`.

Default controls: arrow keys pitch/roll; A/D rudder; W/S throttle; Space pause; R reset;
C cockpit/chase. Select aircraft, then reset to initialize its trimmed flight condition.

## Full screen

Click Full screen in the flight view, or press F. Press Esc to exit.
If native fullscreen is blocked, the view fills the browser window instead.

737 yokes now animate together: arrow keys rotate the wheels and push/pull the columns. Visual movement excludes trim and turbulence.

## Landing and taxiing

Select Parked on ground or Low approach in Start position, then reset. For taxiing, resume with Space, release parking brake with P, add throttle with W, steer with A/D and hold B to brake. G changes landing gear; [ / ] change flap detents. Controls are also in Landing & Ground in the sidebar. C172 gear is fixed; F-15 flaps are not available in the bundled model. Normal wheel contact continues the flight. Ground uses a flat plane with uniform friction; satellite images do not define pavement or elevation. Low-approach starts are level flight at 50 m AGL and are not aligned with a runway.

Default start: 26.246748500933275, 50.15228660429263; heading 000 true. Flat ground: 84 ft MSL.

F-15 missiles: resume airborne flight, press X or Fire missile. Eight fictional unguided rounds; reset reloads.

AI aircraft: F-15 starts with one opponent. T selects an opponent; face it for LOCK, then X launches a fictional homing missile. Sidebar adds opponents/friendlies, chooses patrol/approach, or clears traffic. Four aircraft maximum; AI does not fire back.

F-15 radar: green cockpit scope plus V-toggle larger view. Range buttons change display scale; Search/Track changes the view. T or click an opposing contact selects it. Radar power and fresh sensor tracking affect game missile lock. Detection, timing and ranges are fictional game settings, not real APG-63 performance.

Uploaded F-15 cockpit: select F-15 and cockpit view. Three live upper-panel displays show radar, flight and engine data; the stick follows pilot input. Drag to look, scroll to zoom, double-click to recenter; V toggles the larger radar. Remaining gauges and switches are static.
