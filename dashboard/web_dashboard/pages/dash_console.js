document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("command-input");
    const output = document.getElementById("output");

    // connection buttons
    const connectBtn = document.getElementById("connect-btn");
    const modeBtn = document.getElementById("mode-btn");
    const modeStatus = document.getElementById("mode-status");
    let mode = "manual"; // default

    // ===== GAS GRAPH SETUP =====
const gasCanvas = document.getElementById('gasChart');
const ctx = gasCanvas ? gasCanvas.getContext('2d') : null;
let gasChart = null;
if (ctx) {
    gasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // timestamps
            datasets: [
                {
                    label: 'CO',
                    borderColor: 'rgba(80, 80, 80, 1)',
                    backgroundColor: 'rgba(80, 80, 80, 0.3)',
                    data: [],
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'CH4',
                    borderColor: 'rgba(220, 220, 220, 1)',
                    backgroundColor: 'rgba(220, 220, 220, 0.3)',
                    data: [],
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'LPG',
                    borderColor: 'rgba(100, 130, 180, 1)',
                    backgroundColor: 'rgba(100, 130, 180, 0.3)',
                    data: [],
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Air Quality',
                    borderColor: 'rgba(143, 184, 113, 1)',
                    backgroundColor: 'rgba(180, 180, 180, 0.3)',
                    data: [],
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            animation: false,
            plugins: {
                legend: {
                    labels: { color: 'white' }
                }
            },
            scales: {
                x: { ticks: { color: 'white' } },
                y: {
                    ticks: { color: 'white' },
                    beginAtZero: true,
                    suggestedMax: 100
                }
            }
        }
    });
} else {
    console.warn('gasChart canvas not found; gas graph disabled');
}
    // ====== MAP SETUP ======
    const map = L.map("map").setView([7.351136, -2.341782], 17);

    // Dark theme (Carto basemap)
    L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20,
        }
    ).addTo(map);

    // Default bot position (from GPS)
    let botPosition = L.circleMarker([7.351136, -2.341782], {
        radius: 7,
        color: "white",
        fillColor: "white",
        fillOpacity: 1,
    }).addTo(map).bindPopup("Bot Position");

    let currentRoute = null;
    let destinationMarker = null;

    function generateCrookedRoute(from, to, actionType = "Go To") {
    if (currentRoute) map.removeLayer(currentRoute);
    if (destinationMarker) map.removeLayer(destinationMarker);

    // drop destination pin
    destinationMarker = L.marker(to)
        .addTo(map)
        .bindPopup(`Destination (${actionType})`)
        .openPopup();

    // crooked route points
    let latlngs = [from];
    let numPoints = 3;

    // scale zigzag "noise" by distance
    let latDiff = Math.abs(to.lat - from.lat);
    let lngDiff = Math.abs(to.lng - from.lng);
    let scale = Math.max(latDiff, lngDiff) * 0.5; // half of the span
    let maxJitter = Math.min(scale, 0.0003); // cap so it doesn’t get crazy

    for (let i = 0; i < numPoints; i++) {
        let lat =
            from.lat +
            (to.lat - from.lat) * (i + 1) / (numPoints + 1) +
            (Math.random() - 0.5) * maxJitter;
        let lng =
            from.lng +
            (to.lng - from.lng) * (i + 1) / (numPoints + 1) +
            (Math.random() - 0.5) * maxJitter;
        latlngs.push([lat, lng]);
    }
    latlngs.push(to);

    // dark golden glowing route
    currentRoute = L.polyline(latlngs, {
        color: "#b8860b", // dark golden
        weight: 6,
        opacity: 0.9,
        className: "glow-route",
    }).addTo(map);

    map.fitBounds(currentRoute.getBounds());

    // log to console
    output.innerHTML += `<div>${actionType} (${to.lat.toFixed(
        6
    )}, ${to.lng.toFixed(6)})...</div>`;
}


    // Custom CSS for glowing effect
    const style = document.createElement("style");
    style.innerHTML = `
        .glow-route {
            stroke: #b8860b;
            stroke-width: 6px;
            filter: drop-shadow(0px 0px 6px #ffd700);
        }
    `;
    document.head.appendChild(style);

    // Map click menu
    map.on("click", function (e) {
        let container = L.DomUtil.create("div");
        let goBtn = L.DomUtil.create("button", "", container);
        goBtn.innerHTML = "Go To";
        goBtn.style.margin = "2px";
        goBtn.style.padding = "4px 8px";
        goBtn.style.cursor = "pointer";

        let inspectBtn = L.DomUtil.create("button", "", container);
        inspectBtn.innerHTML = "Inspect";
        inspectBtn.style.margin = "2px";
        inspectBtn.style.padding = "4px 8px";
        inspectBtn.style.cursor = "pointer";

        let popup = L.popup().setLatLng(e.latlng).setContent(container).openOn(map);

        // Go To action
        L.DomEvent.on(goBtn, "click", function () {
            generateCrookedRoute(botPosition.getLatLng(), e.latlng, "Go To");
            popup.remove();
        });

        // Inspect action
        L.DomEvent.on(inspectBtn, "click", function () {
            generateCrookedRoute(botPosition.getLatLng(), e.latlng, "Inspect");
            popup.remove();
        });
    });

// ====== TERMINAL LOGIC ======
input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        const command = input.value.trim();
        output.innerHTML +=
            "<div><span class='prompt'>argus-bot: $</span> " + command + "</div>";

        // ---- SEND command to ESP32 if connected ----
        if (espSocket && espSocket.readyState === WebSocket.OPEN) {
            espSocket.send(JSON.stringify({ cmd: command }));   // NEW
        } else {
            printToConsole("⚠️ ESP32 not connected, command not sent.");
        }

        // ---- Local handling (help, about, etc) ----
        if (command === "help") {
            output.innerHTML += `<div>
                <pre>
System / Info
-------------
help         -> Show this help menu
about        -> Show bot details and version
status       -> Health check(battery, sensor states, connectivity)
uptime       -> How long the bot has been running
date         -> Show system date/time
clear        -> Clear terminal output

Navigation / Movement
---------------------
move forward -> Move bot forward
move back    -> Move bot backward
turn left    -> Rotate bot left
turn right   -> Rotate bot right
stop         -> Emergency stop
goto <x,y>   -> Move to specific coordinate (plot on map)

Sensors
-------
ultrasonic   -> Print distance readings
thermal      -> Show thermal camera status or snapshot
gas          -> Show gas levels (CO, methane, LPG, air quality)
camera on    -> Enable front camera feed
camera off   -> Disable front camera feed
sensors      -> List all active sensors with status

Data / Logs
-----------
log list     -> Show available log files
log view <f> -> Display a specific log
log clear    -> Clear stored logs

Connections
-----------
wifi status  -> Check WiFi status
bt status    -> Check Bluetooth status
ping         -> Test connectivity

Control
-------
mode         -> Show current control mode
manual       -> Switch to manual control mode
auto         -> Switch to autonomous mode
reboot       -> Restart bot system
shutdown     -> Safely power off
</pre>
            </div>`;
        } else if (command === "about") {
                output.innerHTML +=
                    "<div>Industrial Inspection Bot v1.0<br>Developed by ePIKK Robotics <br><br>Credits:<br>&nbsp;&nbsp;&nbsp;Philemon Obed Obeng<br>&nbsp;&nbsp;&nbsp;Benjamin Asare<br>&nbsp;&nbsp;&nbsp;Evans Tetteh<br>&nbsp;&nbsp;&nbsp;Akwasi Frimpong<br><br>This is a terminal to send commands to the Argus bot... <br><br><br> Supervisor : Mr. Bright Ayasu <br> Technical Support : Mr. William Asamoah <br><br><br><br><br>Use 'help' to list available commands.</div>";
            } else if (command === "clear") {
            output.innerHTML = "";
        } else if (command === "mode") {
            output.innerHTML += `<div>Current control mode: <b>${mode.toUpperCase()}</b></div>`;
        } else if (command.startsWith("goto")) {
            let coords = command.replace("goto", "").trim().split(",");
            if (coords.length === 2) {
                let lat = parseFloat(coords[0]);
                let lng = parseFloat(coords[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    let to = L.latLng(lat, lng);
                    generateCrookedRoute(botPosition.getLatLng(), to, "Go To");
                }
            } else {
                output.innerHTML += `<div>Invalid format. Use: goto <lat,lng></div>`;
            }
        } else if (command !== "") {
            output.innerHTML += "<div>Command not found: " + command + "</div>";
        }

        input.value = "";
        output.scrollTop = output.scrollHeight;
    }
});


    function updateModeStatus() {
        modeStatus.textContent = `MODE: ${mode.toUpperCase()}`;
    }

    function printToConsole(message) {
        output.innerHTML += `<div><span class="prompt">$argus-bot:</span> ${message}</div>`;
        output.scrollTop = output.scrollHeight;
    }

    connectBtn.addEventListener("click", function () {
        printToConsole("Attempting connection...");
        setTimeout(() => printToConsole("Connection established successfully."), 1000);
    });

    modeBtn.addEventListener("click", function () {
        mode = mode === "manual" ? "auto" : "manual";
        printToConsole(`Switched mode to: ${mode.toUpperCase()}`);
        updateModeStatus();
    });

    const sensors = [
  { x: 0.00,  y: 2.5,  angle:  90, max_r: 4.0, fov: 30 },
  { x: -1.75, y: 2.5,  angle: 110, max_r: 4.0, fov: 30 },
  { x:  1.75, y: 2.5,  angle:  70, max_r: 4.0, fov: 30 },
  { x: -1.75, y: 0.0,  angle: 180, max_r: 3.0, fov: 30 },
  { x:  1.75, y: 0.0,  angle:   0, max_r: 3.0, fov: 30 },
];

// ====== THERMAL CAM SETUP ======
const thermalCanvas = document.getElementById("thermalCanvas");
const tCtx = thermalCanvas ? thermalCanvas.getContext("2d") : null;

function mapTempToColor(temp, min, max) {
    const ratio = (temp - min) / (max - min);
    const clamped = Math.min(1, Math.max(0, ratio));
    const r = Math.floor(255 * clamped);
    const g = Math.floor(255 * (1 - Math.abs(clamped - 0.5) * 2));
    const b = Math.floor(255 * (1 - clamped));
    return [r, g, b];
}

function drawThermalFrame(frame) {
    if (!tCtx || frame.length !== 768) return; // 32x24 MLX90640
    const min = Math.min(...frame);
    const max = Math.max(...frame);
    const upscaleX = 256 / 32;
    const upscaleY = 192 / 24;
    const imageData = tCtx.createImageData(256, 192);

    for (let y = 0; y < 192; y++) {
        for (let x = 0; x < 256; x++) {
            const gx = x / upscaleX;
            const gy = y / upscaleY;

            const x0 = Math.floor(gx);
            const y0 = Math.floor(gy);
            const x1 = Math.min(x0 + 1, 31);
            const y1 = Math.min(y0 + 1, 23);

            const dx = gx - x0;
            const dy = gy - y0;

            const f00 = frame[y0 * 32 + x0];
            const f10 = frame[y0 * 32 + x1];
            const f01 = frame[y1 * 32 + x0];
            const f11 = frame[y1 * 32 + x1];

            const fxy0 = f00 * (1 - dx) + f10 * dx;
            const fxy1 = f01 * (1 - dx) + f11 * dx;
            const fxy = fxy0 * (1 - dy) + fxy1 * dy;

            const [r, g, b] = mapTempToColor(fxy, min, max);
            const idx = (y * 256 + x) * 4;
            imageData.data[idx] = r;
            imageData.data[idx + 1] = g;
            imageData.data[idx + 2] = b;
            imageData.data[idx + 3] = 255;
        }
    }
    tCtx.putImageData(imageData, 0, 0);
}


const svg = document.getElementById('svg');

function polarToSvg(cx, cy, radius, angleDeg) {
  const cx_svg = cx;
  const cy_svg = -cy;
  const rad = angleDeg * Math.PI / 180;
  const x = cx_svg + radius * Math.cos(rad);
  const y = cy_svg - radius * Math.sin(rad);
  return { x, y };
}

function makeWedgePath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToSvg(cx, cy, radius, startAngle);
  const end   = polarToSvg(cx, cy, radius, endAngle);

  let fov = endAngle - startAngle;
  if (fov < 0) fov += 360;
  const largeArcFlag = (fov > 180) ? 1 : 0;
  const sweepFlag = 0;

  return `M ${cx} ${-cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y} Z`;
}

// Draw arcs (no dots)
sensors.forEach(s => {
  const cx = s.x, cy = s.y, angle = s.angle, fov = s.fov, maxR = s.max_r;
  const startAngle = angle - fov/2;
  const endAngle = angle + fov/2;

  const path = makeWedgePath(cx, cy, maxR, startAngle, endAngle);
  const wedge = document.createElementNS('http://www.w3.org/2000/svg','path');
  wedge.setAttribute('d', path);
  wedge.setAttribute('class', 'wedge');
  svg.appendChild(wedge);
});


    updateModeStatus();


    // ====== ESP32 WEBSOCKET HOOK ======
    let espSocket = null;

    function connectToESP(ip = "ws://192.168.4.1/ws") {
        printToConsole("Connecting to ESP32...");
        espSocket = new WebSocket(ip);

        espSocket.onopen = () => {
            printToConsole("Connected to ESP32 WebSocket ✅");
            console.log("✅ Connected to ESP32");
        };

        espSocket.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
            case "gas": {
                const coVal = msg.mq9_pct;       // CO
                const ch4Val = msg.mq9_pct;      // CH4 (same as CO)
                const lpgVal = msg.mq9_pct;      // LPG (same as CO)
                const airVal = msg.mq135_pct;    // Air quality

                // Update bars
                setProgress("barCO", coVal);
                setProgress("barMethane", ch4Val);
                setProgress("barLPG", lpgVal);
                setProgress("barAir", airVal);

                // Optionally, keep chart too
                if (gasChart) {
                    const now = new Date().toLocaleTimeString();
                    gasChart.data.labels.push(now);
                    gasChart.data.datasets[0].data.push(coVal);
                    gasChart.data.datasets[1].data.push(ch4Val);
                    gasChart.data.datasets[2].data.push(lpgVal);
                    gasChart.data.datasets[3].data.push(airVal);

                    if (gasChart.data.labels.length > 20) {
                        gasChart.data.labels.shift();
                        gasChart.data.datasets.forEach(ds => ds.data.shift());
                    }
                    gasChart.update();
                }
                break;
            }


            case "gps": {
                if (msg.fix) {
                    // Update bot position marker
                    botPosition.setLatLng([msg.lat, msg.lng]);
                    map.panTo([msg.lat, msg.lng]);

                    // Optional: update a route if you want to auto-track
                    if (currentRoute) {
                        let latlngs = currentRoute.getLatLngs();
                        latlngs.push([msg.lat, msg.lng]); // add new position
                        currentRoute.setLatLngs(latlngs);
                    }

                    // Print to console
                    printToConsole(`GPS fix: Lat ${msg.lat.toFixed(6)}, Lng ${msg.lng.toFixed(6)}`);
                } else {
                    printToConsole("GPS: no fix");
                }
                break;
            }


            case "ultrasonic": {
                printToConsole(`Ultrasonic distances (m): ${msg.dist.join(", ")}`);

                msg.dist.forEach((distance, i) => {
                    const wedge = svg.querySelectorAll('.wedge')[i];
                    const sensor = sensors[i];
                    if (!wedge || !sensor) return;

                    // Map distance to radius
                    const radius = Math.min(sensor.max_r, distance);

                    const startAngle = sensor.angle - sensor.fov / 2;
                    const endAngle = sensor.angle + sensor.fov / 2;

                    const pathStr = makeWedgePath(sensor.x, sensor.y, radius, startAngle, endAngle);
                    wedge.setAttribute('d', pathStr);

                    // Optional: color-code close obstacles
                    const color = distance < 1 ? 'rgba(255,0,0,0.5)' :
                                distance < 2 ? 'rgba(255,255,0,0.3)' :
                                                'rgba(0,0,255,0.3)';
                    wedge.setAttribute('fill', color);
                });
                break;
            }

            

            case "thermal": {
                // Expect msg.data to be an array of 768 float values (32x24)
                drawThermalFrame(msg.data);
                break;
            }


            case "motor": {
                printToConsole(`Motor: ${msg.status}, speed=${msg.speed}, steering=${msg.steering_deg}`);
                break;
            }

            case "avoidance": {
                printToConsole(`Avoidance decision: ${msg.decision}`);
                break;
            }

            default:
                console.warn("Unknown message type:", msg);
        }
    } catch (err) {
        console.error("Bad ESP32 data:", event.data);
    }
};


        espSocket.onclose = () => {
            printToConsole("ESP32 WebSocket disconnected ❌");
        };

        espSocket.onerror = (err) => {
            console.error("ESP32 WebSocket Error:", err);
        };
    }


    // Hook the existing connect button to ESP WebSocket
    connectBtn.addEventListener("click", function () {
        connectToESP("ws://192.168.4.1/ws"); // Change IP if ESP is STA on your router
    });

    setInterval(() => {
    if (espSocket && espSocket.readyState === WebSocket.OPEN) {
        espSocket.send("ping");
    }
    }, 10000);

});
