// src/map.js
import * as d3 from "d3";


// Category definitions
const GROUPS = {
  "Housing": [
    "Dwellings without basic facilities",
    "Housing expenditure",
    "Rooms per person"
  ],
  "Income": [
    "GDP per capita (USD)",
    "Household net adjusted disposable income",
    "Household net wealth",
    "Personal earnings"
  ],
  "Jobs": [
    "Labour market insecurity",
    "Employment rate",
    "Long-term unemployment rate"
  ],
  "Community": [
    "Quality of support network"
  ],
  "Education": [
    "Educational attainment",
    "Student skills",
    "Years in education"
  ],
  "Environment": [
    "Air pollution",
    "Water quality"
  ],
  "Civic Engagement": [
    "Stakeholder engagement for developing regulations",
    "Voter turnout"
  ],
  "Health": [
    "Life expectancy",
    "Self-reported health"
  ],
  "Life Satisfaction": [
    "Life satisfaction"
  ],
  "Safety": [
    "Feeling safe walking alone at night",
    "Homicide rate"
  ],
  "Work-Life Balance": [
    "Employees working very long hours",
    "Time devoted to leisure and personal care"
  ]
};

// A small mapping from GeoJSON names → your CSV names
const GEO_TO_CSV = {
  "United Arab Emirates":    "United Arab Emirates",
  "United Republic of Tanzania": "United Republic of Tanzania",
  "USA":                     "United States",
  "England":                 "United Kingdom"
};

export async function drawMap(containerId, options) {
  const opts = {
    containerId,
    csvUrl: options && options.csvUrl ? options.csvUrl : "/data/2024BetterLife.csv",
    geojsonUrl: options && options.geojsonUrl ? options.geojsonUrl : "/data/world.geojson"
  };

  // Container & dimensions
  const container = document.getElementById(opts.containerId);
  if (!container) throw new Error(`Container '#${opts.containerId}' not found`);
  container.style.position = "relative";
  container.innerHTML = ""; // Clear any previous content

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Load CSV and GeoJSON
  const [rawCsv, worldGeo] = await Promise.all([
    d3.csv(opts.csvUrl),
    d3.json(opts.geojsonUrl)
  ]);

  // Parse CSV into typed records and compute group averages
  const data = rawCsv.map(row => {
    const t = {};
    Object.entries(row).forEach(([k, v]) => {
      t[k.trim()] = v;
    });
    // Base record
    const rec = {
      country: t["Country"],
      flag: t["Flag"],
      // Raw values:
      "Life satisfaction": +t["Life satisfaction"],
      "GDP per capita (USD)": +t["GDP per capita (USD)"],
      "Time devoted to leisure and personal care": +t["Time devoted to leisure and personal care"],
      "Rooms per person": +t["Rooms per person"],
      Population: +t["Population"],
      "Dwellings without basic facilities": +t["Dwellings without basic facilities"],
      "Housing expenditure": +t["Housing expenditure"],
      "Labour market insecurity": +t["Labour market insecurity"],
      "Employment rate": +t["Employment rate"],
      "Long-term unemployment rate": +t["Long-term unemployment rate"],
      "Quality of support network": +t["Quality of support network"],
      "Educational attainment": +t["Educational attainment"],
      "Student skills": +t["Student skills"],
      "Years in education": +t["Years in education"],
      "Air pollution": +t["Air pollution"],
      "Water quality": +t["Water quality"],
      "Stakeholder engagement for developing regulations": +t["Stakeholder engagement for developing regulations"],
      "Voter turnout": +t["Voter turnout"],
      "Life expectancy": +t["Life expectancy"],
      "Self-reported health": +t["Self-reported health"],
      "Feeling safe walking alone at night": +t["Feeling safe walking alone at night"],
      "Homicide rate": +t["Homicide rate"],
      "Employees working very long hours": +t["Employees working very long hours"]
    };
    // Compute group averages
    rec.groupAvg = {};
    Object.entries(GROUPS).forEach(([groupName, cols]) => {
      const vals = cols
        .map(c => rec[c])
        .filter(v => v != null && !isNaN(v));
      rec.groupAvg[groupName] = vals.length ? d3.mean(vals) : 0;
    });
    return rec;
  });

  // Compute OECD averages by group
  const oecdAvg = {};
  Object.keys(GROUPS).forEach(groupName => {
    const allVals = data
      .map(d => d.groupAvg[groupName])
      .filter(v => v != null);
    oecdAvg[groupName] = allVals.length ? d3.mean(allVals) : 0;
  });

  // Controls (region dropdown)
  const controls = d3.select(container)
    .append("div")
    .attr("id", "controls")
    .style("position", "absolute")
    .style("top", "8px")
    .style("left", "10px")
    .style("background", "rgba(255,255,255,0.8)")
    .style("padding", "4px 8px")
    .style("border-radius", "4px");
  controls.append("label")
    .attr("for", "region-select")
    .text("Region:");
  const select = controls.append("select")
    .attr("id", "region-select")
    .on("change", () => zoomTo(select.property("value")));
  ["World", "Europe", "Africa", "Asia", "Americas", "Oceania"]
    .forEach(r => select.append("option").attr("value", r).text(r));

  // Comparison widget above the map
  const widgetContainer = d3.select(container)
    .append("div")
    .attr("id", "widget-container")
    .style("position", "absolute")
    .style("top", "50px")
    .style("left", "10px")
    .style("width", "calc(100% - 20px)")
    .style("display", "flex")
    .style("gap", "8px")
    .style("pointer-events", "none"); // so map clicks still work

  // Home country box (left)
  const homeBox = widgetContainer.append("div")
    .attr("id", "home-country-box")
    .style("flex", "1")
    .style("background", "rgba(0,0,0,0.7)")
    .style("color", "#fff")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("font-family", "'Raleway', sans-serif");

  // Selected country box (right)
  const selBox = widgetContainer.append("div")
    .attr("id", "selected-country-box")
    .style("flex", "1")
    .style("background", "rgba(255,255,255,0.9)")
    .style("color", "#333")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("font-family", "'Raleway', sans-serif");

  // Initialize both boxes
  homeBox.html("<em>Home country:<br>None</em>");
  selBox.html("<em>Select a country<br>for details</em>");

  // If a home country is stored, show it now
  const storedName = localStorage.getItem("bli-selected-country");
  let homeRec = null;
  if (storedName) {
    homeRec = data.find(d => d.country === storedName);
    if (homeRec) {
      updateComparisonWidgets(homeRec, null);
    }
  }

  // SVG canvas
  const svg = d3.select(container)
    .append("svg")
    .attr("id", "map-svg")
    .attr("width", width)
    .attr("height", height);

  const projection = d3.geoNaturalEarth1()
    .scale(width / (1.3 * Math.PI))
    .translate([width / 2, height / 2]);
  const path = d3.geoPath(projection);

  // Tooltip for hover
  const tooltip = d3.select(container)
    .append("div")
    .attr("id", "tooltip")
    .classed("hidden", true)
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "rgba(255,255,255,0.95)")
    .style("padding", "8px")
    .style("border", "1px solid #999")
    .style("border-radius", "4px")
    .style("font-family", "'Raleway', sans-serif")
    .style("font-size", "12px")
    .style("z-index", "10");
  d3.select(container).on("mouseleave", () => tooltip.classed("hidden", true));

  // Color scale by life satisfaction
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([d3.min(data, d => d["Life satisfaction"]), d3.max(data, d => d["Life satisfaction"])]);

  // Draw all countries
  const g = svg.append("g");
  g.selectAll("path.country")
    .data(worldGeo.features)
    .enter().append("path")
      .attr("class", "country")
      .attr("d", path)
      .attr("fill", feat => {
        const name = feat.properties.name;
        const csvName = GEO_TO_CSV[name] || name;
        const rec = data.find(d => d.country === csvName);
        return rec ? colorScale(rec["Life satisfaction"]) : "#eee";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", (_, feat) => showTooltip(feat))
      .on("mousemove", moveTooltip)
      .on("mouseout", () => tooltip.classed("hidden", true))
      .on("click", (_, feat) => {
        const name = feat.properties.name;
        const csvName = GEO_TO_CSV[name] || name;
        const rec = data.find(d => d.country === csvName);
        if (rec) {
          // Update selected widget
          updateComparisonWidgets(homeRec, rec);
          // If no home yet, set this as home
          if (!homeRec) {
            homeRec = rec;
            localStorage.setItem("bli-selected-country", rec.country);
            updateComparisonWidgets(homeRec, null);
          }
        }
      });

  // Zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", e => g.attr("transform", e.transform));
  svg.call(zoom);

  // Set the dropdown to World and zoom out
  select.property("value", "World");
  zoomTo("World");

  // ───────────────────────────────────────────────────────────────────────────────
  function zoomTo(region) {
    const boxes = {
      World:   [[-180,-90],[180,90]],
      Europe:  [[-25,34],[40,71]],
      Africa:  [[-20,-35],[55,38]],
      Asia:    [[25,-10],[180,80]],
      Americas:[[-170,-60],[-30,85]],
      Oceania: [[110,-50],[180,10]]
    };
    const [[x0,y0],[x1,y1]] = boxes[region];
    const p0 = projection([x0, y1]);
    const p1 = projection([x1, y0]);
    const dx = p1[0] - p0[0],
          dy = p1[1] - p0[1];
    const xC = (p0[0] + p1[0]) / 2,
          yC = (p0[1] + p1[1]) / 2;
    const scale = Math.min(width / dx, height / dy) * 0.8;
    const translate = [ width / 2 - scale * xC, height / 2 - scale * yC ];
    svg.transition().duration(750)
      .call(zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  }

  function showTooltip(feat) {
    const name    = feat.properties.name;
    const csvName = GEO_TO_CSV[name] || name;
    const rec = data.find(d => d.country === csvName);
    if (!rec) return;

    // Build a small radar chart (Life, GDP, Leisure, Rooms)
    const indicators = ["Life satisfaction", "GDP per capita (USD)", "Time devoted to leisure and personal care", "Rooms per person"];
    const angleStep = 2 * Math.PI / indicators.length;
    const W = 120, H = 120, margin = 10;
    const R = Math.min(W, H)/2 - margin;

    const extentsMap = new Map(
      indicators.map(ind => [
        ind,
        [d3.min(data, d => d[ind]), d3.max(data, d => d[ind])]
      ])
    );

    function computePoints(record) {
      return indicators.map((ind, i) => {
        const [lo, hi] = extentsMap.get(ind);
        const norm = (lo === hi)
          ? d3.scaleLinear().domain([lo-1, hi+1]).range([0, 1])
          : d3.scaleLinear().domain([lo, hi]).range([0, 1]);
        return {
          angle: i * angleStep,
          ratio: norm(record[ind])
        };
      });
    }

    const recPts  = computePoints(rec);
    const oecdPts = computePoints(oecdAvg);

    function polyPath(points) {
      let d = "";
      points.forEach((p, i) => {
        const ang = p.angle - Math.PI/2;
        const r   = R * p.ratio;
        const x   = r * Math.cos(ang);
        const y   = r * Math.sin(ang);
        d += (i === 0 ? "M" : "L") + x + "," + y;
      });
      return d + "Z";
    }

    let radarSvgHtml = `<svg width="${W}" height="${H}"><g transform="translate(${W/2},${H/2})">`;
    // concentric circles
    for (let lvl = 1; lvl <= 4; lvl++) {
      radarSvgHtml += `<circle r="${(R * lvl / 4)}" fill="none" stroke="#ccc"/>`;
    }
    // axes and labels
    indicators.forEach((ind, i) => {
      const ang = i * angleStep - Math.PI/2;
      const xA = R * Math.cos(ang), yA = R * Math.sin(ang);
      radarSvgHtml += `<line x1="0" y1="0" x2="${xA}" y2="${yA}" stroke="#999"/>`;
      const labelX = (R + 12) * Math.cos(ang), labelY = (R + 12) * Math.sin(ang);
      const lab = ind === "Life satisfaction" ? "Life" :
                  ind === "GDP per capita (USD)" ? "GDP" :
                  ind === "Time devoted to leisure and personal care" ? "Leisure" :
                  "Rooms";
      radarSvgHtml += `<text x="${labelX}" y="${labelY}" dy="0.35em" 
        text-anchor="${Math.cos(ang) > 0 ? "start" : "end"}" font-size="8">${lab}</text>`;
    });
    // polygons
    radarSvgHtml += `<path d="${polyPath(recPts)}" fill="#e41a1c" fill-opacity="0.3" stroke="#e41a1c" stroke-width="1"/>`;
    radarSvgHtml += `<path d="${polyPath(oecdPts)}" fill="#4daf4a" fill-opacity="0.3" stroke="#4daf4a" stroke-width="1"/>`;
    radarSvgHtml += `</g></svg>`;

    // Build tooltip HTML
    tooltip.html(`
      <div class="tooltip-header">
        <span class="flag">${rec.flag}</span>
        <span class="name">${rec.country}</span>
        <span class="pop">${(rec.population/1e6).toFixed(2)}M</span>
      </div>
      <div class="tooltip-metric">
        Life satisfaction: <span class="ls-value" style="color:${colorScale(rec["Life satisfaction"])}">${rec["Life satisfaction"].toFixed(1)}</span>
      </div>
      <div class="tooltip-chart">${radarSvgHtml}</div>
      <div class="tooltip-legend">
        <span class="legend-item"><span class="legend-color" style="background:#e41a1c;"></span><span class="legend-label">${rec.country}</span></span>
        <span class="legend-item"><span class="legend-color" style="background:#4daf4a;"></span><span class="legend-label">OECD</span></span>
      </div>
    `).classed("hidden", false);
  }

  function moveTooltip(event) {
    tooltip
      .style("left", `${event.pageX + 10}px`)
      .style("top",  `${event.pageY + 10}px`);
  }

  // Update both home and selected boxes with all categories
  function updateComparisonWidgets(home, sel) {
    if (!home && sel) {
      homeRec = sel;
      localStorage.setItem("bli-selected-country", sel.country);
      updateComparisonWidgets(homeRec, null);
      return;
    }
    homeRec = home || homeRec;

    const categories = Object.keys(GROUPS);
    // Build HTML for home
    let homeHtml = `<div class="widget-header"><span class="flag">${homeRec.flag}</span> <span class="country-name">${homeRec.country}</span></div><ul class="widget-metrics">`;
    categories.forEach(cat => {
      const hVal = homeRec.groupAvg[cat];
      homeHtml += `<li class="metric-item"><span class="metric-label">${cat}:</span> <span class="metric-value home-${cat.replace(/\s+/g, "-")}">${hVal.toFixed(1)}</span></li>`;
    });
    homeHtml += `</ul>`;
    homeBox.html(homeHtml);

    // If sel exists, build its HTML side and color-code differences
    if (sel) {
      let selHtml = `<div class="widget-header"><span class="flag">${sel.flag}</span> <span class="country-name">${sel.country}</span></div><ul class="widget-metrics">`;
      categories.forEach(cat => {
        const hVal = homeRec.groupAvg[cat];
        const sVal = sel.groupAvg[cat];
        // Determine colors
        const hColor = hVal > sVal ? "#4daf4a" : (hVal < sVal ? "#e41a1c" : "#555");
        const sColor = sVal > hVal ? "#4daf4a" : (sVal < hVal ? "#e41a1c" : "#555");
        selHtml += `<li class="metric-item"><span class="metric-label">${cat}:</span> <span class="metric-value sel-${cat.replace(/\s+/g, "-")}" style="color:${sColor};">${sVal.toFixed(1)}</span></li>`;
      });
      selHtml += `</ul>`;
      selBox.html(selHtml);
    } else {
      selBox.html(`<em>Select a country<br>for comparison</em>`);
    }
  }
}
