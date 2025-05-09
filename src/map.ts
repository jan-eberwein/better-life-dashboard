import * as d3 from "d3";

export async function drawMap(containerId: string) {
  const container = d3.select<HTMLElement, unknown>(`#${containerId}`);
  container.selectAll("*").remove();

  const width = container.node()!.clientWidth;
  const height = container.node()!.clientHeight;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const projection = d3
    .geoNaturalEarth1()
    .scale((width / 960) * 160)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath(projection);

  // —— load data from /public/data
  const [world, data] = await Promise.all([
    d3.json("/data/world.geojson") as Promise<GeoJSON.FeatureCollection>,
    d3.csv("/data/2024BetterLife.csv")
  ]);

  const valueMap = new Map<string, number>();
  const flagMap = new Map<string, string>();
  const popMap = new Map<string, number>();

  data.forEach((d: any) => {
    valueMap.set(d.Country, +d["Life satisfaction"]);
    flagMap.set(d.Country, d.Flag);
    popMap.set(d.Country, +d.Population);
  });

  const vals = Array.from(valueMap.values()).filter(v => v != null);
  const [min, max] = d3.extent(vals) as [number, number];

  const color = d3
    .scaleQuantize()
    .domain([min, max])
    .range(d3.schemeBlues[7]);

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "map-tooltip")
    .style("opacity", 0);

  svg
    .append("g")
    .selectAll("path")
    .data(world.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d: any) => {
      const v = valueMap.get(d.properties.name);
      return v != null ? color(v) : "#ccc";
    })
    .attr("stroke", "#333")
    .on("mouseover", (e, d: any) => {
      d3.select(e.currentTarget).attr("stroke-width", 2);
      const name = d.properties.name;
      const v = valueMap.get(name);
      const flag = flagMap.get(name) ?? "";
      const pop = popMap.get(name)?.toLocaleString() ?? "–";

      tooltip
        .html(`<strong>${flag} ${name}</strong><br/>
               Satisfaction: ${v ?? "–"}<br/>
               Population: ${pop}`)
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY + 10 + "px")
        .transition()
        .duration(200)
        .style("opacity", 1);
    })
    .on("mousemove", e => {
      tooltip
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY + 10 + "px");
    })
    .on("mouseout", (e) => {
      d3.select(e.currentTarget).attr("stroke-width", 1);
      tooltip.transition().duration(200).style("opacity", 0);
    });
}
