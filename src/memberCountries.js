import * as d3 from "d3";

// CSV file URL
const CSV_URL = "/data/2024BetterLife.csv";

// Mapping of categories to CSV column names (trimmed – no leading spaces)
export const GROUPS = {
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

export async function renderCountryGrid(selector) {
  // 1) load and auto-type the CSV
  const raw = await d3.csv(CSV_URL, d3.autoType);

  // 2) trim all header names on each row (remove leading/trailing spaces)
  raw.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const trimmed = key.trim();
      if (trimmed !== key) {
        row[trimmed] = row[key];
        delete row[key];
      }
    });
  });

  // 3) compute per-category averages into a new _groupAvg field
  raw.forEach((row) => {
    row._groupAvg = {};
    Object.keys(GROUPS).forEach((cat) => {
      const vals = GROUPS[cat]
        .map((c) => row[c])
        .filter((v) => v != null && !isNaN(v));
      row._groupAvg[cat] = vals.length ? d3.mean(vals) : null;
    });
  });

  // 4) build a 1–10 scale for each category (clamped)
  const scales = {};
  Object.keys(GROUPS).forEach((cat) => {
    const all = raw
      .map((d) => d._groupAvg[cat])
      .filter((v) => v != null);
    const [min, max] = d3.extent(all);
    scales[cat] = d3
      .scaleLinear()
      .domain([min, max])
      .range([1, 10])
      .clamp(true);
  });

  // tooltip container (for hover details)
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
    .selectAll(".country-box")
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
    .style("padding", "8px")
    // ** Hover animation: scale + shadow **
    .style("transition", "transform 0.2s ease, box-shadow 0.2s ease")
    .on("mouseover", function () {
      d3.select(this)
        .style("transform", "scale(1.05)")
        .style("box-shadow", "0 4px 8px rgba(0,0,0,0.2)");
    })
    .on("mouseout", function () {
      d3.select(this).style("transform", "").style("box-shadow", "");
    });

  // flag emoji
  boxes
    .append("div")
    .attr("class", "country-flag")
    .text((d) => d.Flag)
    .style("font-size", "32px")
    .style("line-height", "1");

  // country name
  boxes
    .append("div")
    .attr("class", "country-name")
    .text((d) => d.Country)
    .style("margin-top", "4px")
    .style("font-size", "14px")
    .style("font-weight", "bold");

  // hover tooltip behavior
  boxes
    .on("mouseover.tooltip", (event, d) => {
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
        .text(`Life satisfaction: ${
          lsRaw != null ? lsRaw.toFixed(1) : "—"
        }`);

      // separator
      tooltip
        .append("hr")
        .style("border", "none")
        .style("border-top", "1px solid #ddd")
        .style("margin", "8px 0");

      // --- all category ratings 1–10 ---
      Object.keys(GROUPS).forEach((cat) => {
        const avg = d._groupAvg[cat];
        if (avg != null) {
          const rating = scales[cat](avg);
          const line = tooltip.append("div").style("margin-bottom", "4px");
          line.append("strong").text(`${cat}: `);
          line.append("span").text(rating.toFixed(1));
        }
      });

      tooltip.transition().duration(100).style("opacity", 1);
    })
    .on("mousemove.tooltip", (event) => {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
    })
    .on("mouseout.tooltip", () => {
      tooltip.transition().duration(100).style("opacity", 0);
    });

  // click behavior: select country, save to localStorage, enable Next button
  boxes.on("click", function (event, d) {
    // Deselect all first
    container
      .selectAll(".country-box")
      .style("border-color", "#ddd")
      .style("background", "#fafafa")
      .style("box-shadow", "")
      .classed("selected", false);

    // Mark this one as selected
    d3.select(this)
      .style("border-color", "#007acc")
      .style("background", "#e6f2ff")
      .style("box-shadow", "0 0 0 3px rgba(0,122,204,0.5)")
      .classed("selected", true);

    // Save to localStorage
    localStorage.setItem("bli-selected-country", d.Country);

    // Dispatch a custom event so main.js can enable “Next”
    document.dispatchEvent(new CustomEvent("countrySelected"));
  });
}
