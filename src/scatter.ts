// @ts-nocheck
import * as d3 from "d3";

export async function drawScatter(containerId: string) {
  const container = d3.select(`#${containerId}`);
  container.selectAll("*").remove();

  // dimensions
  const fullW = container.node()?.clientWidth || 700;
  const fullH = 500;
  const margin = { top: 20, right: 20, bottom: 60, left: 60 };
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
  const raw: any[] = await d3.csv("/data/2024BetterLife.csv", d3.autoType);
  if (!raw.length) return;

  // detect keys
  const headers = Object.keys(raw[0]);
  const xKey = headers.find(k => /disposable income/i.test(k))!;
  const yKey = headers.find(k => /very long hours/i.test(k))!;
  const popKey = headers.find(k => /population/i.test(k));

  const data = raw.filter(d => isFinite(d[xKey]) && isFinite(d[yKey]));

  // scales
  const x = d3
    .scaleLinear()
    .domain(d3.extent(data, d => d[xKey]) as [number, number])
    .nice()
    .range([0, w]);
  const y = d3
    .scaleLinear()
    .domain(d3.extent(data, d => d[yKey]) as [number, number])
    .nice()
    .range([h, 0]);
  const rScale = popKey
    ? d3.scaleSqrt().domain(d3.extent(data, d => d[popKey]) as [number, number]).range([3, 18])
    : () => 6;

  // continent palette
  const palette: Record<string, string> = {
    Europe: "#1f77b4",
    Americas: "#ff7f0e",
    Asia: "#2ca02c",
    Oceania: "#d62728",
  };
  function regionOf(country: string): string {
    const eu = ["Austria","Belgium","Czechia","Denmark","Estonia","Finland",
      "France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Latvia",
      "Lithuania","Luxembourg","Netherlands","Norway","Poland","Portugal",
      "Slovak Republic","Slovenia","Spain","Sweden","Switzerland","Türkiye",
      "United Kingdom"];
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
    .call(d3.axisLeft(y).tickFormat(d => `${d}%`));

  // labels
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#000")
    .text("Household net adjusted disposable income (USD)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("fill", "#000")
    .text("Employees working very long hours (%)");

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

  // draw points
  g.selectAll("circle")
    .data(data, d => d.Country)
    .join("circle")
    .attr("cx", d => x(d[xKey]))
    .attr("cy", d => y(d[yKey]))
    .attr("r", d => (popKey ? rScale(d[popKey]) : rScale()))
    .attr("fill", d => palette[regionOf(d.Country)])
    .attr("opacity", 0.8)
    .on("mouseover", (e: any, d: any) => {
      d3.select(".scatter-tip")
        .style("opacity", 1)
        .html(
          `<strong>${d.Flag} ${d.Country}</strong><br/>
           Income: $${fmt(d[xKey])}<br/>
           Hours: ${d[yKey]}%<br/>
           Population: ${popKey ? fmt(d[popKey]) : "n/a"}`
        )
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY + 10 + "px");
    })
    .on("mouseout", () => d3.select(".scatter-tip").style("opacity", 0));
}