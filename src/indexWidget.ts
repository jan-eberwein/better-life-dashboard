// src/indexWidget.ts
import * as d3 from "d3";

type Row = Record<string, any>;

// define groups and their underlying CSV columns
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
} as const;

type Group = keyof typeof GROUPS;

// assign each group a distinct color
const groupColor = d3.scaleOrdinal<string,string>()
  .domain(Object.keys(GROUPS))
  .range(d3.schemeSet3 as string[]);

interface CountryScores {
  Country: string;
  scores: Record<Group, number>;
  composite: number;
}

export async function drawIndexWidget(containerId: string) {
  const container = d3.select<HTMLElement,unknown>("#" + containerId);
  container.selectAll("*").remove();
  container
    .style("font-family", "'Railway', sans-serif")
    .style("padding", "12px")
    .style("border", "1px solid #ddd")
    .style("border-radius", "6px")
    .style("background", "#fafafa");

  // load data
  const raw: Row[] = await d3.csv("/data/2024BetterLife.csv", d3.autoType);

  // precompute group scores per country
  const countries: CountryScores[] = raw.map(r => {
    const scores = {} as Record<Group, number>;
    for (const grp of Object.keys(GROUPS) as Group[]) {
      const vals = GROUPS[grp]
        .map(c => +r[c])
        .filter(v => !isNaN(v));
      scores[grp] = vals.length ? d3.mean(vals)! : 0;
    }
    return { Country: r.Country, scores, composite: 0 };
  });

  // controls: sliders for each group
  const controls = container.append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fit, minmax(180px, 1fr))")
    .style("gap", "8px")
    .style("margin-bottom", "12px");

  // weight store
  const weight = {} as Record<Group, number>;

  (Object.keys(GROUPS) as Group[]).forEach(grp => {
    weight[grp] = 0;
    const wrap = controls.append("div")
      .style("font-size", "14px")
      .style("color", groupColor(grp));

    wrap.append("label")
      .text(grp)
      .style("display", "block")
      .style("font-weight", "bold");

    wrap.append("input")
      .attr("type", "range")
      .attr("min", 0).attr("max", 10).attr("step", 1)
      .attr("value", 0)
      .style("width", "100%")
      .style("accent-color", groupColor(grp))
      .on("input", function() {
        weight[grp] = +(this as HTMLInputElement).value;
        updateRanking();
      })
      .on("input.value", function() {
        wrap.select(".slider-value").text((this as HTMLInputElement).value);
      });

    wrap.append("span")
      .attr("class", "slider-value")
      .text("0")
      .style("margin-left", "6px")
      .style("font-weight", "bold");
  });

  // chart container
  const chartWrap = container.append("div")
    .style("overflow-y", "auto")
    .style("max-height", "480px");

  const svg = chartWrap.append("svg").attr("width", "100%");

  // tooltip with mini radar
  const tooltip = d3.select("body").append("div")
    .attr("class", "ranking-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "#fff")
    .style("border", "1px solid #aaa")
    .style("border-radius", "4px")
    .style("padding", "8px")
    .style("opacity", 0);

  function updateRanking() {
    // use Life Satisfaction if all weights zero
    const totalW = d3.sum(Object.values(weight));
    const useWeights = totalW > 0 ? weight : { "Life Satisfaction": 1 };
    const sumW = d3.sum(Object.values(useWeights));

    countries.forEach(c => {
      let s = 0;
      for (const [grp, w] of Object.entries(useWeights) as [Group, number][]) {
        s += (c.scores[grp] || 0) * w;
      }
      c.composite = sumW ? s / sumW : 0;
    });
    countries.sort((a, b) => b.composite - a.composite);

    // draw bars
    const margin = { top: 20, right: 20, bottom: 20, left: 150 };
    const cw = (chartWrap.node() as HTMLElement).clientWidth;
    const width = cw - margin.left - margin.right;
    const height = countries.length * 20;

    svg.attr("height", height + margin.top + margin.bottom).selectAll("*").remove();

    const x = d3.scaleLinear()
      .domain([0, d3.max(countries, d => d.composite)!])
      .range([0, width]);

    const y = d3.scaleBand<string>()
      .domain(countries.map(d => d.Country))
      .range([margin.top, margin.top + height])
      .padding(0.1);

    // x-axis
    svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top + height})`)
      .call(d3.axisBottom(x).ticks(5));

    // bars
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)      
      .selectAll("rect")
      .data(countries)
      .join("rect")
        .attr("y", d => y(d.Country)!)
        .attr("width", d => x(d.composite))
        .attr("height", y.bandwidth())
        .attr("fill", "#69b3a2")
        .on("mouseover", (e, d) => {
          drawRadarTooltip(d);
          tooltip.transition().duration(150).style("opacity", 1);
        })
        .on("mousemove", e => {
          tooltip
            .style("left", (e.pageX + 12) + "px")
            .style("top",  (e.pageY + 12) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(150).style("opacity", 0));

    // labels
    svg.append("g")
      .attr("transform", `translate(${margin.left - 6},0)`)      
      .selectAll("text")
      .data(countries)
      .join("text")
        .attr("x", 0)
        .attr("y", d => y(d.Country)! + y.bandwidth()/2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .text(d => d.Country);
  }

  function drawRadarTooltip(c: CountryScores) {
    tooltip.html("");
    const size = 120;
    const r = size / 2 - 10;
    const svgT = tooltip.append("svg")
      .attr("width", size)
      .attr("height", size)
      .style("font-family", "'Railway', sans-serif");

    const groups = Object.keys(GROUPS) as Group[];
    const values = groups.map(g => c.scores[g]);
    const angleStep = Math.PI * 2 / groups.length;
    const radial = d3.scaleLinear()
      .domain([0, d3.max(values)!])
      .range([0, r]);

    // grid lines
    for (let i = 0; i < groups.length; i++) {
      const angle = i * angleStep - Math.PI / 2;
      svgT.append("line")
        .attr("x1", size / 2)
        .attr("y1", size / 2)
        .attr("x2", size / 2 + Math.cos(angle) * r)
        .attr("y2", size / 2 + Math.sin(angle) * r)
        .attr("stroke", "#ccc");
    }

    // polygon
    const line = d3.lineRadial<number>()
      .radius(d => radial(d))
      .angle((_, i) => i * angleStep);
    svgT.append("path")
      .datum(values)
      
  }

  // init
  updateRanking();
}