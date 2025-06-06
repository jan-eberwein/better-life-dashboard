// src/memberCountries.ts
import * as d3 from "d3";

// CSV file URL
const CSV_URL = "/data/2024BetterLife.csv";

// Mapping of categories to CSV column names (trimmed – no leading spaces)
export const GROUPS: Record<string, string[]> = {
  Housing: [
    "Dwellings without basic facilities",
    "Housing expenditure",
    "Rooms per person",
  ],
  Income: [
    "GDP per capita (USD)",
    "Household net adjusted disposable income",
    "Household net wealth",
    "Personal earnings",
  ],
  Jobs: [
    "Labour market insecurity",
    "Employment rate",
    "Long-term unemployment rate",
  ],
  Community: ["Quality of support network"],
  Education: ["Educational attainment", "Student skills", "Years in education"],
  Environment: ["Air pollution", "Water quality"],
  "Civic Engagement": [
    "Stakeholder engagement for developing regulations",
    "Voter turnout",
  ],
  Health: ["Life expectancy", "Self-reported health"],
  "Life Satisfaction": ["Life satisfaction"],
  Safety: ["Feeling safe walking alone at night", "Homicide rate"],
  "Work-Life Balance": [
    "Employees working very long hours",
    "Time devoted to leisure and personal care",
  ],
};

export async function renderCountryGrid(selector: string) {
  // 1) load and auto-type the CSV
  const raw = await d3.csv(CSV_URL, d3.autoType);

  // 2) trim all header names on each row (remove those pesky leading spaces)
  raw.forEach((row: any) => {
    Object.keys(row).forEach(key => {
      const trimmed = key.trim();
      if (trimmed !== key) {
        row[trimmed] = row[key];
        delete row[key];
      }
    });
  });

  // 3) compute per-category averages into a new _groupAvg field
  raw.forEach((row: any) => {
    row._groupAvg = {} as Record<string, number | null>;
    for (const [cat, cols] of Object.entries(GROUPS)) {
      const vals = cols
        .map(c => row[c])
        .filter(v => v != null && !isNaN(v));
      row._groupAvg[cat] = vals.length ? d3.mean(vals) : null;
    }
  });

  // 4) build a 1–10 scale for each category (clamped)
  const scales: Record<string, d3.ScaleLinear<number, number>> = {};
  for (const cat of Object.keys(GROUPS)) {
    const all = raw
      .map((d: any) => d._groupAvg[cat])
      .filter((v): v is number => v != null);
    const [min, max] = d3.extent(all) as [number, number];
    scales[cat] = d3
      .scaleLinear()
      .domain([min, max])
      .range([1, 10])
      .clamp(true);
  }

  // tooltip container
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "country-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "#fff")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("padding", "8px")
    .style("font-family", "'Raleway', sans-serif")
    .style("font-size", "12px")
    .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
    .style("opacity", 0);

  // grid container
  const container = d3
    .select(selector)
    .style("display", "grid")
    .style("grid-template-columns", "repeat(auto-fill, minmax(120px, 1fr))")
    .style("gap", "16px")
    .style("padding", "16px");

  const boxes = container
    .selectAll<HTMLDivElement, any>(".country-box")
    .data(raw)
    .enter()
    .append("div")
    .attr("class", "country-box")
    .style("cursor", "pointer")
    .style("border", "1px solid #ddd")
    .style("border-radius", "4px")
    .style("overflow", "hidden")
    .style("text-align", "center")
    .style("background", "#fafafa")
    .style("padding", "8px");

  // flag emoji
  boxes
    .append("div")
    .attr("class", "country-flag")
    .text((d: any) => d.Flag)
    .style("font-size", "32px")
    .style("line-height", "1");

  // country name
  boxes
    .append("div")
    .attr("class", "country-name")
    .text((d: any) => d.Country)
    .style("margin-top", "4px")
    .style("font-size", "14px")
    .style("font-weight", "bold");

  // hover behavior
  boxes
    .on("mouseover", (event, d: any) => {
      tooltip.html("");

      // --- header: flag + name, population + raw life satisfaction ---
      const header = tooltip.append("div").style("margin-bottom", "8px");
      header
        .append("div")
        .style("font-size", "24px")
        .style("font-weight", "700")
        .html(`${d.Flag} ${d.Country}`);
      header
        .append("div")
        .text(`Population: ${d3.format(",")(d.Population ?? 0)}`);
      const lsRaw = d["Life satisfaction"];
      header
        .append("div")
        .text(
          `Life satisfaction: ${lsRaw != null ? lsRaw.toFixed(1) : "—"}`
        );

      // separator
      tooltip
        .append("hr")
        .style("border", "none")
        .style("border-top", "1px solid #ddd")
        .style("margin", "8px 0");

      // --- all category ratings 1–10 ---
      for (const cat of Object.keys(GROUPS)) {
        const avg = d._groupAvg[cat];
        if (avg != null) {
          const rating = scales[cat](avg);
          const line = tooltip.append("div").style("margin-bottom", "4px");
          line.append("strong").text(`${cat}: `);
          line.append("span").text(rating.toFixed(1));
        }
      }

      tooltip.transition().duration(100).style("opacity", 1);
    })
    .on("mousemove", (event) => {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
    })
    .on("mouseout", () => {
      tooltip.transition().duration(100).style("opacity", 0);
    });
}
