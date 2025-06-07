// src/scatter.js
import * as d3 from "d3";

// ISO2 codes for flags (including Australia)
const COUNTRY_CODE = {
  "Austria":"at","Belgium":"be","Canada":"ca","Chile":"cl","Colombia":"co","Costa Rica":"cr",
  "Czechia":"cz","Denmark":"dk","Estonia":"ee","Finland":"fi","France":"fr","Germany":"de",
  "Greece":"gr","Hungary":"hu","Iceland":"is","Ireland":"ie","Israel":"il","Italy":"it",
  "Japan":"jp","Korea":"kr","Latvia":"lv","Lithuania":"lt","Luxembourg":"lu","Mexico":"mx",
  "Netherlands":"nl","New Zealand":"nz","Norway":"no","Poland":"pl","Portugal":"pt",
  "Slovak Republic":"sk","Slovenia":"si","Spain":"es","Sweden":"se","Switzerland":"ch",
  "Türkiye":"tr","United Kingdom":"gb","United States":"us","Australia":"au"
};
function flagUrl(country) {
  const code = COUNTRY_CODE[country];
  return code
    ? `https://GlobalArtInc.github.io/round-flags/flags/${code}.svg`
    : null;
}

// region grouping arrays
const EU = ["Austria","Belgium","Czechia","Denmark","Estonia","Finland",
  "France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Latvia",
  "Lithuania","Luxembourg","Netherlands","Norway","Poland","Portugal",
  "Slovak Republic","Slovenia","Spain","Sweden","Switzerland","Türkiye",
  "United Kingdom"];
const AM = ["Canada","Chile","Colombia","Costa Rica","Mexico","United States"];
const AS = ["Israel","Japan","Korea"];
const OC = ["Australia","New Zealand"];
function regionOf(country) {
  if (EU.includes(country)) return "Europe";
  if (AM.includes(country)) return "America";
  if (AS.includes(country)) return "Asia";
  if (OC.includes(country)) return "Oceania";
}

export async function drawScatter(containerId) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  // controls: region dropdown only
  const controls = container.append("div")
    .attr("class", "scatter-controls")
    .style("margin-bottom", "8px")
    .style("display", "flex")
    .style("gap", "12px");
  const regionSelect = controls.append("select").attr("id", "region-select");
  ["All","Europe","America","Asia","Oceania"].forEach(r => {
    regionSelect.append("option").attr("value", r).text(r);
  });

  // dimensions
  const fullW = container.node().clientWidth || 700;
  const fullH = 500;
  const margin = { top: 20, right: 130, bottom: 60, left: 60 };
  const w = fullW - margin.left - margin.right;
  const h = fullH - margin.top - margin.bottom;

  // SVG setup
  const svg = container.append("svg")
    .attr("width", fullW)
    .attr("height", fullH)
    .attr("viewBox", `0 0 ${fullW} ${fullH}`);
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // load data
  const raw = await d3.csv("/data/2024BetterLife.csv", d3.autoType);
  if (!raw.length) return;
  const headers = Object.keys(raw[0]);
  const xKey = headers.find(k => /gdp per capita/i.test(k));
  const yKey = headers.find(k => /life satisfaction/i.test(k));
  const popKey = headers.find(k => /population/i.test(k));
  const data = raw.filter(d => isFinite(d[xKey]) && isFinite(d[yKey]));

  // scales
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d[xKey])).nice()
    .range([0, w]);
  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d[yKey])).nice()
    .range([h, 0]);
  const rScale = popKey
    ? d3.scaleSqrt().domain(d3.extent(data, d => d[popKey])).range([8, 32])
    : () => 16;

  // axes
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("$.2s")));
  g.append("g")
    .call(d3.axisLeft(y));

  // axis labels
  g.append("text")
    .attr("x", w / 2).attr("y", h + 40)
    .attr("text-anchor", "middle").text("GDP per capita (USD)");
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2).attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Life satisfaction (0–10)");

  // tooltip
  const tip = d3.select("body").append("div")
    .attr("class", "scatter-tip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // group for flag points
  const pointsG = g.append("g").attr("class", "points");

  // update function
  function update() {
    const region = regionSelect.property("value");
    const filtered = data.filter(d => region === "All" || regionOf(d.Country) === region);
    const saved = localStorage.getItem("bli-selected-country");

    // data join
    const groups = pointsG.selectAll("g.flag-group")
      .data(filtered, d => d.Country);

    groups.exit().remove();

    const enter = groups.enter().append("g")
      .attr("class", "flag-group")
      .on("mouseover", (e, d) => showTip(e, d))
      .on("mouseout", () => tip.style("opacity", 0));

    // circle outline
    enter.append("circle")
      .attr("class", "flag-circle")
      .attr("stroke-width", 2)
      .attr("fill", "none");

    // flag image
    enter.append("image")
      .attr("class", "flag-img");

    const all = enter.merge(groups);
    all.attr("transform", d => `translate(${x(d[xKey])},${y(d[yKey])})`);
    all.select("circle.flag-circle")
      .attr("r", d => rScale(d[popKey]))
      .attr("stroke", d => d.Country === saved ? "#000" : "#666");

    all.select("image.flag-img")
      .attr("x", d => -rScale(d[popKey]))
      .attr("y", d => -rScale(d[popKey]))
      .attr("width", d => rScale(d[popKey]) * 2)
      .attr("height", d => rScale(d[popKey]) * 2)
      .attr("href", d => flagUrl(d.Country) || "")
      .style("opacity", 0.9);
  }

  function showTip(e, d) {
    tip.html(
      `<strong>${d.Country}</strong><br/>
       GDP: $${d3.format(",")(d[xKey])}<br/>
       Life sat.: ${d3.format(".1f")(d[yKey])}<br/>
       Pop.: ${d3.format(",")(d[popKey])}`
    )
    .style("left", `${e.pageX + 10}px`)
    .style("top", `${e.pageY + 10}px`)
    .transition().duration(100).style("opacity", 0.9);
  }

  // events
  regionSelect.on("change", update);

  // initial render
  update();
}
