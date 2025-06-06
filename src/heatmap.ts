// src/heatmap.ts
import * as d3 from "d3";

const HIGHLIGHTS = [
  { a: "Labour market insecurity", b: "Long-term unemployment rate" },
  { a: "GDP per capita",             b: "Personal earnings"              },
  { a: "Employment rate",           b: "Water quality"                 },
  { a: "Dwellings without basic facilities", b: "Homicide rate"        },
  { a: "Personal earnings",         b: "Life satisfaction"             },
  { a: "Student skills",            b: "Homicide rate"                 },
  { a: "Rooms per person",          b: "Air pollution"                 },
  { a: "Air pollution",             b: "Life satisfaction"             },
  { a: "Student skills",            b: "Employees working very long hours" },
  { a: "Educational attainment",    b: "Employees working very long hours" }
];

export async function drawHeatmap(containerId: string) {
  // prepare container
  const container = d3.select<HTMLElement, unknown>(`#${containerId}`);
  container.selectAll("*").remove();

  // dimensions
  const width  = container.node()!.clientWidth  || 700;
  const height = 650;
  const margin = { top: 40, right: 20, bottom: 100, left: 120 };
  const innerW = width  - margin.left - margin.right;
  const innerH = height - margin.top  - margin.bottom;

  // load data
  const raw = await d3.csv("/data/2024BetterLife.csv", d3.autoType);
  if (!raw.length) return;

  // numeric columns
  const cols = raw.columns.filter(
    (c) => typeof raw[0][c] === "number" && c !== "Population"
  ) as string[];

  // build matrix
  const matrix: { x: number; y: number; value: number }[] = [];
  cols.forEach((c1, i) =>
    cols.forEach((c2, j) =>
      matrix.push({ x: j, y: i, value: computeCorrelation(
        raw.map(r => r[c1] as number),
        raw.map(r => r[c2] as number)
      )})
    )
  );

  // scales
  const xScale = d3.scaleBand<number>()
    .domain(d3.range(cols.length))
    .range([0, innerW])
    .padding(0.02);

  const yScale = d3.scaleBand<number>()
    .domain(d3.range(cols.length))
    .range([0, innerH])
    .padding(0.02);

  const colorScale = d3.scaleDiverging<number>()
    .domain([-1, 0, 1])
    .interpolator(d3.interpolateRdBu);

  // svg
  const svg = container.append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("border-radius", "8px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  // gridlines (white strokes)
  svg.append("g")
    .selectAll("rect")
    .data(matrix)
    .enter()
    .append("rect")
      .attr("x", d => xScale(d.x)!)
      .attr("y", d => yScale(d.y)!)
      .attr("width",  xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill",   d => colorScale(d.value))
      .attr("stroke", "white")
      .attr("stroke-width", 1);

  // highlight key pairs
  HIGHLIGHTS.forEach(({ a, b }) => {
    const i = cols.indexOf(b);
    const j = cols.indexOf(a);
    if (i >= 0 && j >= 0) {
      svg.append("rect")
        .attr("x", xScale(i)!)
        .attr("y", yScale(j)!)
        .attr("width",  xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill",   "none")
        .attr("stroke", "#333")
        .attr("stroke-width", 3);
    }
  });

  // axes labels
  svg.append("g")
    .selectAll("text")
    .data(cols)
    .enter()
    .append("text")
      .attr("x", (_, i) => xScale(i)! + xScale.bandwidth()/2)
      .attr("y", innerH + 12)
      .attr("text-anchor", "start")
      .attr("transform", (_, i) =>
        `translate(0,0) rotate(45, ${xScale(i)! + xScale.bandwidth()/2}, ${innerH + 12})`
      )
      .style("font-weight", "bold")
      .style("font-size", "12px")
      .text(d => d);

  svg.append("g")
    .selectAll("text")
    .data(cols)
    .enter()
    .append("text")
      .attr("x", -10)
      .attr("y", (_, i) => yScale(i)! + yScale.bandwidth()/2)
      .attr("text-anchor", "end")
      .attr("dy", "0.35em")
      .style("font-weight", "bold")
      .style("font-size", "12px")
      .text(d => d);

  // tooltip
  const tooltip = d3.select("body").append("div")
      .attr("class", "heatmap-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(255,255,255,0.95)")
      .style("padding", "8px 12px")
      .style("border", "1px solid #aaa")
      .style("border-radius", "4px")
      .style("font-size", "13px")
      .style("box-shadow", "0 1px 4px rgba(0,0,0,0.2)")
      .style("opacity", 0);

  svg.selectAll("rect")
    .on("mouseover", (e, d) => {
      tooltip
        .html(
          `<strong>${cols[d.y]}</strong> vs <strong>${cols[d.x]}</strong><br/>r = ${d.value.toFixed(2)}`
        )
        .style("left", `${e.pageX + 12}px`)
        .style("top",  `${e.pageY + 12}px`)
        .transition().duration(150).style("opacity", 1);
    })
    .on("mouseout", () =>
      tooltip.transition().duration(150).style("opacity", 0)
    );
}

/** Pearson correlation */
function computeCorrelation(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = d3.mean(a)!;
  const meanB = d3.mean(b)!;
  const cov = d3.sum(a.map((v,i) => (v-meanA)*(b[i]-meanB))) / (n-1);
  const sdA = Math.sqrt(d3.sum(a.map(v => (v-meanA)**2)) / (n-1));
  const sdB = Math.sqrt(d3.sum(b.map(v => (v-meanB)**2)) / (n-1));
  return cov / (sdA * sdB);
}
