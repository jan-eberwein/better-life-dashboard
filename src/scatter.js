import * as d3 from "d3";

export async function drawScatter(containerId) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  // dimensions
  const fullW = container.node()?.clientWidth || 700;
  const fullH = 500;
  const margin = { top: 20, right: 130, bottom: 60, left: 60 }; // Increased right margin for legend
  const w = fullW - margin.left - margin.right;
  const h = fullH - margin.top - margin.bottom;

  // SVG setup
  const svg = container
    .append("svg")
    .attr("width", fullW)
    .attr("height", fullH)
    .attr("viewBox", `0 0 ${fullW} ${fullH}`);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // load & parse
  const raw = await d3.csv("/data/2024BetterLife.csv", d3.autoType); //
  if (!raw.length) return;

  // Get selected country from localStorage
  const selectedCountry = localStorage.getItem("bli-selected-country");

  // detect keys for new comparison
  const headers = Object.keys(raw[0]);
  const xKey = headers.find(k => /gdp per capita/i.test(k));
  const yKey = headers.find(k => /life satisfaction/i.test(k));
  const popKey = headers.find(k => /population/i.test(k));

  const data = raw.filter(d => isFinite(d[xKey]) && isFinite(d[yKey]));

  // scales
  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, d => d[xKey]))
    .nice()
    .range([0, w]);
  const y = d3
    .scaleLinear()
    .domain(d3.extent(data, d => d[yKey]))
    .nice()
    .range([h, 0]);

  // MODIFIED: Keep min size, increase max size
  const rScale = popKey
    ? d3.scaleSqrt().domain(d3.extent(data, d => d[popKey])).range([5, 30])
    : () => 6;

  // continent palette
  const palette = {
    Europe: "#1f77b4",
    Americas: "#ff7f0e",
    Asia: "#2ca02c",
    Oceania: "#d62728"
  };
  function regionOf(country) {
    const eu = [
      "Austria","Belgium","Czechia","Denmark","Estonia","Finland",
      "France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Latvia",
      "Lithuania","Luxembourg","Netherlands","Norway","Poland","Portugal",
      "Slovak Republic","Slovenia","Spain","Sweden","Switzerland","Türkiye",
      "United Kingdom"
    ];
    const am = ["Canada","Chile","Colombia","Costa Rica","Mexico","United States"];
    const as = ["Israel","Japan","Korea"];
    const oc = ["Australia","New Zealand"];
    if (eu.includes(country)) return "Europe";
    if (am.includes(country)) return "Americas";
    if (as.includes(country)) return "Asia";
    if (oc.includes(country)) return "Oceania";
    return "Europe";
  }

  // axes
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("$.2s")));
  g.append("g")
    .call(d3.axisLeft(y));

  // labels
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#000")
    .text("GDP per capita (USD)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("fill", "#000")
    .text("Life satisfaction (Score 0-10)");

  // tooltip
  let tip = d3.select("body").selectAll(".scatter-tip").data([0]);
  tip
    .enter()
    .append("div")
    .attr("class", "scatter-tip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .merge(tip);

  const fmt = d3.format(",");
  const scoreFmt = d3.format(".1f");

  // draw points
  const circles = g.selectAll("circle")
    .data(data, d => d.Country)
    .join("circle")
      .attr("cx", d => x(d[xKey]))
      .attr("cy", d => y(d[yKey]))
      .attr("r", d => (popKey ? rScale(d[popKey]) : rScale()))
      .attr("fill", d => palette[regionOf(d.Country)])
      .attr("opacity", d => (selectedCountry && d.Country !== selectedCountry) ? 0.5 : 0.9)
      .attr("stroke", d => d.Country === selectedCountry ? "black" : "none")
      .attr("stroke-width", d => d.Country === selectedCountry ? 2 : 0)
      .on("mouseover", (e, d) => {
        d3.select(".scatter-tip")
          .style("opacity", 1)
          .html(
            `<strong>${d.Flag} ${d.Country}</strong><br/>
             GDP per capita: $${fmt(d[xKey])}<br/>
             Life Satisfaction: ${scoreFmt(d[yKey])}<br/>
             Population: ${popKey ? fmt(d[popKey]) : "n/a"}`
          )
          .style("left", e.pageX + 10 + "px")
          .style("top", e.pageY + 10 + "px");
      })
      .on("mouseout", () => d3.select(".scatter-tip").style("opacity", 0));
      
  // Raise the selected country's circle to be on top
  if (selectedCountry) {
    circles.filter(d => d.Country === selectedCountry).raise();
  }
    
  // Add Legend
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${w + 20}, 0)`);

  const legendItems = legend.selectAll(".legend-item")
    .data(Object.entries(palette))
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 25})`);

  legendItems.append("rect")
    .attr("width", 18)
    .attr("height", 18)
    .attr("fill", d => d[1])
    .attr("opacity", selectedCountry ? 0.5 : 0.9);

  legendItems.append("text")
    .attr("x", 24)
    .attr("y", 14)
    .text(d => d[0])
    .style("font-size", "14px")
    .attr("alignment-baseline", "middle")
    .attr("opacity", selectedCountry ? 0.7 : 1.0);
}