(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* Mock survey data — demo dataset powering the UI (no live backend) */
  /* ---------------------------------------------------------------- */

  var TYPES = {
    plastic: { label: "Plastic & Packaging", color: "#2a78d6" },
    metal:   { label: "Metal & Drums",       color: "#eb6834" },
    net:     { label: "Ghost Nets & Rope",   color: "#1baf7a" },
    other:   { label: "Other / Unclassified", color: "#8b8f94" }
  };

  var SURVEY_AREA_KM2 = 1.8;

  var nextId = 1000;
  var detections = [
    { id: nextId++, type: "plastic", confidence: 91, depth: 6.2,  x: 18, y: 28, status: "confirmed", hazard: 2 },
    { id: nextId++, type: "net",     confidence: 94, depth: 11.4, x: 34, y: 55, status: "confirmed", hazard: 5 },
    { id: nextId++, type: "metal",   confidence: 88, depth: 9.1,  x: 52, y: 22, status: "confirmed", hazard: 4 },
    { id: nextId++, type: "plastic", confidence: 96, depth: 4.8,  x: 65, y: 40, status: "confirmed", hazard: 1 },
    { id: nextId++, type: "net",     confidence: 83, depth: 14.0, x: 78, y: 62, status: "confirmed", hazard: 5 },
    { id: nextId++, type: "other",   confidence: 90, depth: 7.5,  x: 44, y: 75, status: "confirmed", hazard: 2 },
    { id: nextId++, type: "metal",   confidence: 72, depth: 10.2, x: 23, y: 60, status: "pending",   hazard: 4 },
    { id: nextId++, type: "plastic", confidence: 58, depth: 5.5,  x: 59, y: 18, status: "pending",   hazard: 2 },
    { id: nextId++, type: "net",     confidence: 67, depth: 12.8, x: 71, y: 30, status: "pending",   hazard: 5 },
    { id: nextId++, type: "other",   confidence: 49, depth: 8.0,  x: 30, y: 42, status: "pending",   hazard: 2 },
    { id: nextId++, type: "metal",   confidence: 63, depth: 6.9,  x: 86, y: 48, status: "pending",   hazard: 3 },
    { id: nextId++, type: "plastic", confidence: 55, depth: 3.9,  x: 12, y: 70, status: "pending",   hazard: 1 },
    { id: nextId++, type: "net",     confidence: 76, depth: 15.6, x: 50, y: 85, status: "pending",   hazard: 5 },
    { id: nextId++, type: "plastic", confidence: 93, depth: 5.1,  x: 90, y: 72, status: "confirmed", hazard: 1 }
  ];

  var trendHistory = [
    { label: "Feb", value: 3.1 }, { label: "Mar", value: 3.4 }, { label: "Apr", value: 3.6 },
    { label: "May", value: 4.0 }, { label: "Jun", value: 4.3 }, { label: "Jul", value: 4.7 },
    { label: "Aug", value: 5.0 }, { label: "Sep", value: 5.4 }
  ];

  var scans = [
    { file: "VSKP_SSS_2026-09-18_0007.xtf", date: "18 Sep 2026", tiles: 412, detections: 6, status: "Processed" },
    { file: "VSKP_SSS_2026-09-11_0006.xtf", date: "11 Sep 2026", tiles: 388, detections: 4, status: "Processed" },
    { file: "VSKP_SSS_2026-09-04_0005.xtf", date: "04 Sep 2026", tiles: 401, detections: 4, status: "Processed" },
    { file: "VSKP_SSS_2026-08-28_0004.jsf", date: "28 Aug 2026", tiles: 355, detections: 3, status: "Processed" }
  ];

  var activeFilters = new Set(Object.keys(TYPES));
  var selectedPinId = null;

  /* ---------------------------------------------------------------- */
  /* Live Analysis API — real backend, real model (optional)          */
  /* ---------------------------------------------------------------- */

  var API_BASE = window.JALNIRIKSH_API_BASE || "http://localhost:8000";
  var backendOnline = false;

  function materialBadge(mat) {
    if (!mat) return "—";
    if (/Hard|Metal/i.test(mat)) return '<span class="badge badge-warn">Metallic</span>';
    if (/Soft|Synthetic|Plastic/i.test(mat)) return '<span class="badge badge-good">Synthetic</span>';
    return '<span class="badge badge-muted">Unclassified</span>';
  }

  function renderLiveResult(data) {
    var panel = $("#liveResultPanel");
    panel.hidden = false;
    $("#liveResultMeta").textContent = data.is_demo_mode
      ? "Model: simulation mode"
      : "Model: " + data.model.model_name + " · " + data.timing_ms.inference_time_ms + "ms";
    $("#liveResultImg").src = data.annotated_image;

    var tbody = $("#liveResultTable tbody");
    tbody.innerHTML = "";
    $("#liveResultEmpty").hidden = data.detections.length > 0;

    data.detections.forEach(function (d) {
      tbody.appendChild(el("tr", {}, [
        el("td", { text: d.display_label || d.class_name }),
        el("td", { html: '<span class="badge ' + (d.confidence >= 0.8 ? "badge-good" : "badge-warn") + '">' + Math.round(d.confidence * 100) + "%</span>" }),
        el("td", { html: materialBadge(d.material_density) }),
        el("td", { text: (d.threat_score != null ? d.threat_score : "—") + (d.threat_score != null ? " / 100" : "") }),
        el("td", { text: d.estimated_height_meters ? d.estimated_height_meters.toFixed(2) + " m" : "—" })
      ]));
    });
  }

  function analyzeBlob(blob, filename) {
    var form = new FormData();
    form.append("file", blob, filename || "scan.png");
    var row = { file: filename || "live_scan.png", date: "Just now", tiles: 1, detections: 0, status: "Processing" };
    scans.unshift(row);
    renderScans();

    return fetch(API_BASE + "/api/analyze", { method: "POST", body: form })
      .then(function (r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); })
      .then(function (data) {
        row.status = "Processed";
        row.detections = data.detections.length;
        renderScans();
        renderLiveResult(data);
        toast((data.is_demo_mode ? "Simulation" : "Live model") + ": " + data.detections.length + " detection(s) found");
      })
      .catch(function (err) {
        row.status = "Processed";
        renderScans();
        toast("Live Analysis API unreachable — showing simulated ingestion instead");
        simulateUpload(filename || "uploaded_scan.png");
        console.warn("[JalNiriksh] live analysis failed:", err);
      });
  }

  function analyzeSample(name, btn) {
    if (btn) btn.disabled = true;
    fetch(API_BASE + "/api/analyze-sample/" + encodeURIComponent(name), { method: "POST" })
      .then(function (r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); })
      .then(function (data) {
        renderLiveResult(data);
        toast((data.is_demo_mode ? "Simulation" : "Live model") + ": " + data.detections.length + " detection(s) found in " + name);
      })
      .catch(function (err) {
        toast("Could not reach the Live Analysis API for " + name);
        console.warn("[JalNiriksh] sample analysis failed:", err);
      })
      .finally(function () { if (btn) btn.disabled = false; });
  }

  function renderSampleButtons(names) {
    var row = $("#sampleRow");
    row.innerHTML = "";
    names.forEach(function (name) {
      var label = name.replace(/^sample_/, "").replace(/\.[a-z]+$/, "").replace(/_/g, " ");
      var btn = el("button", { type: "button", text: "▶ " + label });
      btn.addEventListener("click", function () { analyzeSample(name, btn); });
      row.appendChild(btn);
    });
  }

  function checkBackend() {
    var dot = $("#liveDot"), text = $("#liveStatusText");
    var routeDot = $("#routeDot"), routeText = $("#routeStatusText"), routeBtn = $("#planRouteBtn");
    fetch(API_BASE + "/api/health", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (health) {
        backendOnline = true;
        dot.className = "dot online";
        text.textContent = health.demo_mode
          ? "Live Analysis API connected (model weights not found — running in simulation mode)"
          : "Live Analysis API connected — real YOLO-ESI model loaded";
        routeDot.className = "dot online";
        routeText.textContent = "Route-planning API connected — OR-Tools solver ready";
        routeBtn.disabled = false;
        return fetch(API_BASE + "/api/samples").then(function (r) { return r.json(); });
      })
      .then(function (data) { if (data && data.samples) renderSampleButtons(data.samples); })
      .catch(function () {
        backendOnline = false;
        dot.className = "dot offline";
        text.textContent = "Live Analysis API offline — uploads will use simulated ingestion (see backend/README)";
        routeDot.className = "dot offline";
        routeText.textContent = "Route-planning API offline — start backend/ to compute a real OR-Tools route";
        routeBtn.disabled = true;
      });
  }

  function renderRouteOrder(result, items) {
    var panel = $("#routeResultPanel");
    panel.hidden = false;
    $("#routeMeta").textContent = result.total_distance_km + " km · " + result.solver;
    var list = $("#routeOrderList");
    list.innerHTML = "";
    list.appendChild(el("li", { class: "boat" }, [el("span", { class: "step-num", text: "⚓" }), el("span", { text: "Boat" })]));
    result.order.forEach(function (id, i) {
      var item = items.find(function (it) { return it.id === id; });
      list.appendChild(el("span", { class: "arrow", text: "→" }));
      list.appendChild(el("li", {}, [
        el("span", { class: "step-num", text: String(i + 1) }),
        el("span", { text: typeInfo(item.type).label + " (" + item.depth.toFixed(1) + "m)" })
      ]));
    });
    list.appendChild(el("span", { class: "arrow", text: "→" }));
    list.appendChild(el("li", { class: "boat" }, [el("span", { class: "step-num", text: "⚓" }), el("span", { text: "Boat" })]));
  }

  function planRouteNow() {
    var btn = $("#planRouteBtn");
    var confirmedItems = detections.filter(function (d) { return d.status === "confirmed" || d.status === "collected"; });
    if (confirmedItems.length < 2) {
      toast("Need at least 2 confirmed items to plan a route");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Solving…";
    fetch(API_BASE + "/api/plan-route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boat_start: { x: 0, y: 0 },
        items: confirmedItems.map(function (d) { return { id: d.id, x: d.x, y: d.y }; })
      })
    })
      .then(function (r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); })
      .then(function (result) {
        renderRouteOrder(result, confirmedItems);
        toast("Route solved: " + result.order.length + " stops, " + result.total_distance_km + " km");
      })
      .catch(function (err) {
        toast("Route planning API unreachable");
        console.warn("[JalNiriksh] route planning failed:", err);
      })
      .finally(function () { btn.disabled = false; btn.textContent = "▶ Plan Route (OR-Tools)"; });
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }
  function svgEl(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  function confidenceTier(pct) { return pct >= 80 ? "high" : "review"; }
  function typeInfo(t) { return TYPES[t] || TYPES.other; }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._h);
    toast._h = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------------------------------------------------------------- */
  /* Routing                                                           */
  /* ---------------------------------------------------------------- */

  var ROUTES = ["overview", "scans", "review", "map", "recovery", "reports"];

  function route() {
    var hash = (location.hash || "#/overview").replace("#/", "");
    if (ROUTES.indexOf(hash) === -1) hash = "overview";
    $all(".view").forEach(function (v) { v.classList.remove("active"); });
    $("#view-" + hash).classList.add("active");
    $all(".side-nav a").forEach(function (a) {
      a.classList.toggle("active", a.dataset.route === hash);
    });
    if (hash === "map") renderMap();
  }
  window.addEventListener("hashchange", route);

  /* ---------------------------------------------------------------- */
  /* KPIs + Overview                                                   */
  /* ---------------------------------------------------------------- */

  function renderKPIs() {
    var confirmed = detections.filter(function (d) { return d.status === "confirmed" || d.status === "collected"; });
    var pending = detections.filter(function (d) { return d.status === "pending" && confidenceTier(d.confidence) === "review"; });
    $("#kpiDetected").textContent = detections.length;
    $("#kpiPending").textContent = pending.length;
    $("#kpiCleanliness").textContent = (confirmed.length / SURVEY_AREA_KM2).toFixed(1);
    $("#kpiRoutes").textContent = "2";

    var badge = $("#reviewCount");
    badge.textContent = pending.length;
    badge.dataset.zero = pending.length === 0 ? "true" : "false";
  }

  function renderRecentTable() {
    var tbody = $("#recentTable tbody");
    tbody.innerHTML = "";
    detections.slice(-6).reverse().forEach(function (d) {
      var ti = typeInfo(d.type);
      var tier = confidenceTier(d.confidence);
      tbody.appendChild(el("tr", {}, [
        el("td", { html: '<span class="type-dot" style="background:' + ti.color + '"></span>' }),
        el("td", { text: ti.label }),
        el("td", { html: '<span class="badge ' + (tier === "high" ? "badge-good" : "badge-warn") + '">' + (tier === "high" ? "High" : "Review") + " · " + d.confidence + "%</span>" }),
        el("td", { text: d.depth.toFixed(1) + " m" }),
        el("td", { html: statusBadge(d.status) })
      ]));
    });
  }

  function statusBadge(status) {
    if (status === "confirmed") return '<span class="badge badge-good">Confirmed</span>';
    if (status === "collected") return '<span class="badge badge-good">Collected</span>';
    if (status === "rejected") return '<span class="badge badge-muted">Rejected</span>';
    return '<span class="badge badge-warn">Pending</span>';
  }

  /* ---------------------------------------------------------------- */
  /* Bar chart — Detections by Type                                    */
  /* ---------------------------------------------------------------- */

  function renderBarChart() {
    var counts = {};
    Object.keys(TYPES).forEach(function (t) { counts[t] = 0; });
    detections.forEach(function (d) { counts[d.type]++; });
    var rows = Object.keys(TYPES).map(function (t) { return { type: t, count: counts[t] }; })
      .sort(function (a, b) { return b.count - a.count; });

    var svg = $("#chartBars");
    svg.innerHTML = "";
    var w = 460, rowH = 34, gap = 10, labelW = 150, max = Math.max.apply(null, rows.map(function (r) { return r.count; })) || 1;
    var chartW = w - labelW - 50;
    var h = rows.length * (rowH + gap);
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    rows.forEach(function (r, i) {
      var y = i * (rowH + gap);
      var barW = Math.max(4, (r.count / max) * chartW);
      var g = svgEl("g", { class: "bar-row" });
      g.appendChild(svgEl("text", { x: 0, y: y + rowH / 2 + 4, class: "bar-label" }));
      g.lastChild.textContent = typeInfo(r.type).label;
      g.appendChild(svgEl("rect", {
        x: labelW, y: y + 4, width: barW, height: rowH - 8, rx: 4,
        fill: typeInfo(r.type).color
      }));
      var vt = svgEl("text", { x: labelW + barW + 8, y: y + rowH / 2 + 4, class: "bar-value" });
      vt.textContent = r.count;
      g.appendChild(vt);
      svg.appendChild(g);
    });

    var table = $("#chartBarsTable");
    table.innerHTML = "<tr><th>Type</th><th>Count</th></tr>" + rows.map(function (r) {
      return "<tr><td>" + typeInfo(r.type).label + "</td><td>" + r.count + "</td></tr>";
    }).join("");
  }

  /* ---------------------------------------------------------------- */
  /* Line chart — Cleanliness Index trend                              */
  /* ---------------------------------------------------------------- */

  function renderLineChart(targetId, data, big) {
    var svg = $(targetId);
    svg.innerHTML = "";
    var w = 520, h = big ? 240 : 160, padL = 34, padR = 16, padT = 16, padB = 26;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    var defs = svgEl("defs");
    var grad = svgEl("linearGradient", { id: "lineFill", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#2a78d6", "stop-opacity": 0.35 }));
    grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#2a78d6", "stop-opacity": 0 }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    var values = data.map(function (d) { return d.value; });
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    min = Math.floor(min - (max - min) * 0.2);
    max = Math.ceil(max + (max - min) * 0.1);
    var innerW = w - padL - padR, innerH = h - padT - padB;

    function xAt(i) { return padL + (i / (data.length - 1)) * innerW; }
    function yAt(v) { return padT + innerH - ((v - min) / (max - min || 1)) * innerH; }

    // gridlines
    [0, 0.5, 1].forEach(function (f) {
      var gy = padT + innerH * f;
      svg.appendChild(svgEl("line", { x1: padL, x2: w - padR, y1: gy, y2: gy, class: "grid-line" }));
    });

    // area
    var areaPts = data.map(function (d, i) { return xAt(i) + "," + yAt(d.value); }).join(" L ");
    var areaPath = "M " + xAt(0) + "," + (padT + innerH) + " L " + areaPts + " L " + xAt(data.length - 1) + "," + (padT + innerH) + " Z";
    svg.appendChild(svgEl("path", { d: areaPath, class: "line-area" }));

    // line
    var linePts = data.map(function (d, i) { return (i === 0 ? "M " : "L ") + xAt(i) + "," + yAt(d.value); }).join(" ");
    svg.appendChild(svgEl("path", { d: linePts, class: "line-path" }));

    // x labels
    data.forEach(function (d, i) {
      svg.appendChild(svgEl("text", { x: xAt(i), y: h - 6, class: "axis-tick", "text-anchor": "middle" })).textContent = d.label;
    });

    // dots + hover
    var tooltip = svgEl("g", { class: "chart-tooltip", style: "display:none" });
    var ttRect = svgEl("rect", { width: 58, height: 28, rx: 6 });
    var ttText = svgEl("text", { x: 8, y: 18 });
    tooltip.appendChild(ttRect); tooltip.appendChild(ttText);

    data.forEach(function (d, i) {
      var dot = svgEl("circle", { cx: xAt(i), cy: yAt(d.value), r: 4, class: "line-dot" });
      dot.addEventListener("mouseenter", function () {
        dot.classList.add("hot");
        ttText.textContent = d.label + ": " + d.value;
        var tx = Math.min(Math.max(xAt(i) - 29, padL), w - padR - 58);
        tooltip.setAttribute("transform", "translate(" + tx + "," + (yAt(d.value) - 38) + ")");
        tooltip.style.display = "block";
      });
      dot.addEventListener("mouseleave", function () {
        dot.classList.remove("hot");
        tooltip.style.display = "none";
      });
      svg.appendChild(dot);
    });
    svg.appendChild(tooltip);

    var table = $(targetId === "#chartLine" ? "#chartLineTable" : null);
    if (table) {
      table.innerHTML = "<tr><th>Survey</th><th>Index</th></tr>" + data.map(function (d) {
        return "<tr><td>" + d.label + "</td><td>" + d.value + "</td></tr>";
      }).join("");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Scans                                                             */
  /* ---------------------------------------------------------------- */

  function renderScans() {
    var tbody = $("#scansTable tbody");
    tbody.innerHTML = "";
    scans.forEach(function (s) {
      tbody.appendChild(el("tr", {}, [
        el("td", { text: s.file }),
        el("td", { text: s.date }),
        el("td", { text: s.tiles }),
        el("td", { text: s.detections }),
        el("td", { html: s.status === "Processing" ? '<div class="progress"><span style="width:0%"></span></div>' : statusBadge("confirmed").replace("Confirmed", "Processed") })
      ]));
    });
  }

  function simulateUpload(filename) {
    var row = { file: filename, date: "Just now", tiles: 0, detections: 0, status: "Processing" };
    scans.unshift(row);
    renderScans();
    var bar = $("#scansTable tbody tr:first-child .progress > span");
    var pct = 0;
    var timer = setInterval(function () {
      pct += 18 + Math.random() * 14;
      if (pct >= 100) {
        pct = 100;
        clearInterval(timer);
        row.status = "Processed";
        row.tiles = 300 + Math.floor(Math.random() * 150);
        row.detections = Math.floor(Math.random() * 5);
        renderScans();
        toast(filename + " processed — " + row.detections + " detection(s) found");
      }
      if (bar) bar.style.width = pct + "%";
    }, 260);
  }

  /* ---------------------------------------------------------------- */
  /* Review queue                                                      */
  /* ---------------------------------------------------------------- */

  function renderReview() {
    var grid = $("#reviewGrid");
    grid.innerHTML = "";
    var queue = detections.filter(function (d) { return d.status === "pending"; });
    $("#reviewEmpty").hidden = queue.length > 0;

    queue.forEach(function (d) {
      var ti = typeInfo(d.type);
      var card = el("div", { class: "review-card", "data-id": d.id }, [
        el("div", { class: "crop-thumb", text: "◎ sonar crop" }),
        el("h3", { text: ti.label + " (likely)" }),
        el("div", { class: "review-meta" }, [
          el("span", { html: '<span class="badge badge-warn">' + d.confidence + "% confidence</span>" }),
          el("span", { text: d.depth.toFixed(1) + " m depth" }),
          el("span", { text: "hazard " + d.hazard + "/5" })
        ]),
        el("div", { class: "review-actions" }, [
          el("button", { class: "btn btn-confirm btn-sm", text: "✓ Confirm" }),
          el("button", { class: "btn btn-reject btn-sm", text: "✕ Reject" })
        ])
      ]);
      var confirmBtn = card.querySelectorAll("button")[0];
      var rejectBtn = card.querySelectorAll("button")[1];
      confirmBtn.addEventListener("click", function () { resolveReview(d.id, "confirmed", card); });
      rejectBtn.addEventListener("click", function () { resolveReview(d.id, "rejected", card); });
      grid.appendChild(card);
    });
  }

  function resolveReview(id, status, card) {
    var item = detections.find(function (d) { return d.id === id; });
    if (item) item.status = status;
    card.classList.add("removing");
    setTimeout(function () {
      renderReview();
      renderKPIs();
      renderRecentTable();
      renderBarChart();
      renderRecovery();
    }, 180);
    toast((status === "confirmed" ? "Confirmed" : "Rejected") + " — observation saved to retrain the model");
  }

  /* ---------------------------------------------------------------- */
  /* Map — real CesiumJS 3D globe, no Ion token required               */
  /* ---------------------------------------------------------------- */

  // Visakhapatnam Port approach, India — survey area mapped onto real lat/long.
  // (Verified offshore in the Bay of Bengal via reverse-geocode, not over the city.)
  var HARBOUR_LAT = 17.68, HARBOUR_LON = 83.35;
  var SURVEY_WIDTH_KM = 1.6, SURVEY_HEIGHT_KM = 1.0;
  var KM_PER_DEG_LAT = 110.574;
  var KM_PER_DEG_LON = 111.320 * Math.cos(HARBOUR_LAT * Math.PI / 180);

  function demoToLatLon(x, y) {
    var dxKm = ((x - 50) / 100) * SURVEY_WIDTH_KM;
    var dyKm = ((50 - y) / 100) * SURVEY_HEIGHT_KM; // invert: smaller y (top) = further north
    return {
      lat: HARBOUR_LAT + dyKm / KM_PER_DEG_LAT,
      lon: HARBOUR_LON + dxKm / KM_PER_DEG_LON
    };
  }

  var cesiumViewer = null;
  var cesiumEntities = {}; // detection id -> {point, ring}

  function initCesium() {
    if (cesiumViewer || typeof Cesium === "undefined") return;
    Cesium.Ion.defaultAccessToken = undefined;

    cesiumViewer = new Cesium.Viewer("cesiumContainer", {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      imageryProvider: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: true,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: false
    });
    cesiumViewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })
    );
    cesiumViewer.scene.globe.enableLighting = false;
    cesiumViewer.scene.skyAtmosphere.show = true;

    // Survey coverage footprint
    var corner = demoToLatLon(0, 0), corner2 = demoToLatLon(100, 100);
    cesiumViewer.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(
          Math.min(corner.lon, corner2.lon), Math.min(corner.lat, corner2.lat),
          Math.max(corner.lon, corner2.lon), Math.max(corner.lat, corner2.lat)
        ),
        material: Cesium.Color.fromCssColorString("#1baf7a").withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#1baf7a").withAlpha(0.4)
      }
    });

    cesiumViewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(HARBOUR_LON, HARBOUR_LAT, 1800)
    });

    cesiumViewer.screenSpaceEventHandler.setInputAction(function (click) {
      var picked = cesiumViewer.scene.pick(click.position);
      if (picked && picked.id && picked.id.jalniriksh_detection_id != null) {
        selectedPinId = picked.id.jalniriksh_detection_id;
        var d = detections.find(function (x) { return x.id === selectedPinId; });
        if (d) showMapDetail(d);
        refreshMapSelectionStyle();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function refreshMapSelectionStyle() {
    Object.keys(cesiumEntities).forEach(function (id) {
      var isSel = Number(id) === selectedPinId;
      cesiumEntities[id].point.outlineWidth = isSel ? 3 : 1;
      cesiumEntities[id].point.pixelSize = isSel ? 16 : 12;
    });
  }

  function renderMapLegend() {
    var list = $("#mapLegend");
    list.innerHTML = "";
    Object.keys(TYPES).forEach(function (t) {
      var count = detections.filter(function (d) { return d.type === t; }).length;
      list.appendChild(el("li", {}, [
        el("span", { class: "type-dot", style: "background:" + TYPES[t].color }),
        el("span", { text: TYPES[t].label }),
        el("span", { class: "count", text: count })
      ]));
    });
  }

  function renderMapFilters() {
    var wrap = $("#mapFilters");
    wrap.innerHTML = "";
    Object.keys(TYPES).forEach(function (t) {
      var chip = el("button", { class: "chip-toggle active", text: TYPES[t].label, "data-type": t });
      chip.addEventListener("click", function () {
        if (activeFilters.has(t)) { activeFilters.delete(t); chip.classList.remove("active"); }
        else { activeFilters.add(t); chip.classList.add("active"); }
        applyMapFilters();
      });
      wrap.appendChild(chip);
    });
  }

  function applyMapFilters() {
    detections.forEach(function (d) {
      var ent = cesiumEntities[d.id];
      if (!ent) return;
      var visible = activeFilters.has(d.type);
      ent.point.show = visible;
      ent.ring.show = visible;
    });
  }

  function renderMapPins() {
    if (!cesiumViewer) return;
    cesiumViewer.entities.removeAll();
    cesiumEntities = {};

    var corner = demoToLatLon(0, 0), corner2 = demoToLatLon(100, 100);
    cesiumViewer.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(
          Math.min(corner.lon, corner2.lon), Math.min(corner.lat, corner2.lat),
          Math.max(corner.lon, corner2.lon), Math.max(corner.lat, corner2.lat)
        ),
        material: Cesium.Color.fromCssColorString("#1baf7a").withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#1baf7a").withAlpha(0.4)
      }
    });

    detections.forEach(function (d) {
      var ll = demoToLatLon(d.x, d.y);
      var color = Cesium.Color.fromCssColorString(typeInfo(d.type).color);
      var accuracyRadiusM = 15 + (100 - d.confidence) * 1.2; // tighter circle = higher confidence

      var ringEntity = cesiumViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(ll.lon, ll.lat),
        ellipse: {
          semiMinorAxis: accuracyRadiusM,
          semiMajorAxis: accuracyRadiusM,
          material: color.withAlpha(0.12),
          outline: true,
          outlineColor: color.withAlpha(0.6),
          height: 0
        }
      });

      var pointEntity = cesiumViewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(ll.lon, ll.lat, 2),
        point: {
          pixelSize: 12,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        jalniriksh_detection_id: d.id
      });
      pointEntity.jalniriksh_detection_id = d.id;

      cesiumEntities[d.id] = { point: pointEntity.point, ring: ringEntity.ellipse };
    });

    applyMapFilters();
    cesiumViewer.zoomTo(cesiumViewer.entities, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 1400));
  }

  function showMapDetail(d) {
    var box = $("#mapDetail");
    var ti = typeInfo(d.type);
    var ll = demoToLatLon(d.x, d.y);
    box.innerHTML =
      '<dl>' +
      "<dt>Type</dt><dd>" + ti.label + "</dd>" +
      "<dt>Confidence</dt><dd>" + d.confidence + "%</dd>" +
      "<dt>Depth</dt><dd>" + d.depth.toFixed(1) + " m</dd>" +
      "<dt>Hazard</dt><dd>" + d.hazard + " / 5</dd>" +
      "<dt>Status</dt><dd>" + d.status + "</dd>" +
      "<dt>Lat, Lon</dt><dd>" + ll.lat.toFixed(5) + ", " + ll.lon.toFixed(5) + "</dd>" +
      "</dl>";
  }

  function renderMap() {
    initCesium();
    renderMapLegend();
    renderMapFilters();
    // Cesium needs a layout pass before sizing correctly on a freshly-shown view
    setTimeout(function () {
      renderMapPins();
      if (cesiumViewer) cesiumViewer.resize();
    }, 50);
  }

  /* ---------------------------------------------------------------- */
  /* Recovery planner                                                  */
  /* ---------------------------------------------------------------- */

  function renderRecovery() {
    var tbody = $("#recoveryTable tbody");
    tbody.innerHTML = "";
    var confirmedItems = detections
      .filter(function (d) { return d.status === "confirmed" || d.status === "collected"; })
      .sort(function (a, b) { return b.hazard - a.hazard; });

    confirmedItems.forEach(function (d, i) {
      var method = d.depth > 8 ? "ROV" : "Diver";
      var row = el("tr", {}, [
        el("td", { text: String(i + 1) }),
        el("td", { html: '<span class="type-dot" style="background:' + typeInfo(d.type).color + '"></span>' + typeInfo(d.type).label }),
        el("td", { text: d.hazard + " / 5" }),
        el("td", { text: d.depth.toFixed(1) + " m" }),
        el("td", { text: method }),
        el("td")
      ]);
      var statusCell = row.lastChild;
      if (d.status === "collected") {
        statusCell.innerHTML = '<span class="badge badge-good">Collected</span>';
        row.style.opacity = "0.55";
      } else {
        var cb = el("label", { html: '<input type="checkbox" /> Mark collected' });
        cb.querySelector("input").addEventListener("change", function () {
          d.status = "collected";
          renderRecovery();
          renderKPIs();
        });
        statusCell.appendChild(cb);
      }
      tbody.appendChild(row);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Reports / export                                                  */
  /* ---------------------------------------------------------------- */

  function downloadBlob(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    var rows = [["id", "type", "confidence_pct", "depth_m", "hazard", "status"]];
    detections.filter(function (d) { return d.status === "confirmed" || d.status === "collected"; })
      .forEach(function (d) { rows.push([d.id, d.type, d.confidence, d.depth, d.hazard, d.status]); });
    var csv = rows.map(function (r) { return r.join(","); }).join("\n");
    downloadBlob("jalniriksh_confirmed_detections.csv", csv, "text/csv");
    toast("CSV exported");
  }

  function exportGeojson() {
    var features = detections.filter(function (d) { return d.status === "confirmed" || d.status === "collected"; })
      .map(function (d) {
        return {
          type: "Feature",
          properties: { type: d.type, confidence: d.confidence, depth_m: d.depth, hazard: d.hazard, status: d.status },
          geometry: { type: "Point", coordinates: [d.x, d.y] }
        };
      });
    var geojson = JSON.stringify({ type: "FeatureCollection", features: features }, null, 2);
    downloadBlob("jalniriksh_confirmed_detections.geojson", geojson, "application/geo+json");
    toast("GeoJSON exported");
  }

  /* ---------------------------------------------------------------- */
  /* Wire-up                                                           */
  /* ---------------------------------------------------------------- */

  function init() {
    renderKPIs();
    renderRecentTable();
    renderBarChart();
    renderLineChart("#chartLine", trendHistory, false);
    renderLineChart("#chartLineBig", trendHistory, true);
    renderScans();
    renderReview();
    renderRecovery();
    route();

    var dz = $("#dropzone"), fi = $("#fileInput");
    dz.addEventListener("click", function () { fi.click(); });
    ["dragenter", "dragover"].forEach(function (evt) {
      dz.addEventListener(evt, function (e) { e.preventDefault(); dz.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      dz.addEventListener(evt, function (e) { e.preventDefault(); dz.classList.remove("drag"); });
    });
    dz.addEventListener("drop", function (e) {
      var f = e.dataTransfer.files[0];
      if (f) analyzeBlob(f, f.name);
    });
    fi.addEventListener("change", function () {
      if (fi.files[0]) analyzeBlob(fi.files[0], fi.files[0].name);
      fi.value = "";
    });

    $("#newScanBtn").addEventListener("click", function () {
      location.hash = "#/scans";
      setTimeout(function () { simulateUpload("VSKP_SSS_" + new Date().toISOString().slice(0, 10) + "_live.xtf"); }, 200);
    });

    checkBackend();

    $("#exportCsv").addEventListener("click", exportCsv);
    $("#exportGeojson").addEventListener("click", exportGeojson);
    $("#planRouteBtn").addEventListener("click", planRouteNow);

    $("#harbourSelect").addEventListener("change", function (e) {
      toast("Switched to " + e.target.value + " (demo data shown)");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
