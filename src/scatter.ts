// src/scatter.ts

import * as d3 from "d3";

export async function drawScatter(containerId: string) {
    // ─── Select & clear container ────────────────────────────────
    const container = d3.select<HTMLElement, unknown>(`#${containerId}`);
    container.selectAll("*").remove();

    // ─── Dimensions & margins ────────────────────────────────────
    const fullW = container.node()!.clientWidth || 700;
    const fullH = 450;
    const m = { top: 20, right: 20, bottom: 60, left: 60 };
    const w = fullW  - m.left - m.right;
    const h = fullH - m.top  - m.bottom;

    // ─── SVG setup ───────────────────────────────────────────────
    const svg = container
        .append("svg")
        .attr("width",  fullW)
        .attr("height", fullH)
        .attr("viewBox", `0 0 ${fullW} ${fullH}`);

    const g = svg.append("g")
        .attr("transform", `translate(${m.left},${m.top})`);

    // ─── Load & parse CSV ────────────────────────────────────────
    const raw: any[] = await d3.csv("/data/2024BetterLife.csv", d3.autoType);
    if (!raw.length) {
        g.append("text")
            .text("No data available.")
            .attr("x", 0)
            .attr("y", 20);
        return;
    }

    // ─── Detect column keys dynamically ──────────────────────────
    const headers = Object.keys(raw[0]);
    const xKey = headers.find(h => /disposable income/i.test(h))!;
    const yKey = headers.find(h => /very long hours/i.test(h))!;
    const popKey = headers.find(h => /population/i.test(h)); // optional

    const data = raw.filter(d => isFinite(d[xKey]) && isFinite(d[yKey]));

    // ─── Scales ─────────────────────────────────────────────────
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d[xKey]) as [number, number])
        .nice()
        .range([0, w]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d[yKey]) as [number, number])
        .nice()
        .range([h, 0]);

    const r = popKey
        ? d3.scaleSqrt()
            .domain(d3.extent(data, d => d[popKey]) as [number, number])
            .range([3, 18])
        : () => 6;

    // ─── Colour & region helper ────────────────────────────────
    const palette: Record<string, string> = {
        Europe:   "#1f77b4",
        Americas: "#ff7f0e",
        Asia:     "#2ca02c",
        Oceania:  "#d62728"
    };
    function regionOf(country: string): keyof typeof palette {
        const eu = ["Austria","Belgium","Czechia","Denmark","Estonia","Finland",
            "France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Latvia",
            "Lithuania","Luxembourg","Netherlands","Norway","Poland","Portugal",
            "Slovak Republic","Slovenia","Spain","Sweden","Switzerland","Türkiye",
            "United Kingdom"];
        const am = ["Canada","Chile","Colombia","Costa Rica","Mexico","United States"];
        const as = ["Israel","Japan","Korea"];
        const oc = ["Australia","New Zealand"];
        if (eu.includes(country))    return "Europe";
        if (am.includes(country))    return "Americas";
        if (as.includes(country))    return "Asia";
        if (oc.includes(country))    return "Oceania";
        return "Europe";
    }

    // ─── Axes ────────────────────────────────────────────────────
    g.append("g")
        .attr("transform", `translate(0,${h})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("$.2s")))
        .append("text")
        .attr("x", w / 2)
        .attr("y", 40)
        .attr("text-anchor", "middle")
        .attr("fill", "#000")
        .text("Household net adjusted disposable income (USD)");

    g.append("g")
        .call(d3.axisLeft(y).tickFormat(d => `${d}%`))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -h / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .attr("fill", "#000")
        .text("Employees working very long hours (%)");

    // ─── Tooltip container ──────────────────────────────────────
    let tip = d3.select<HTMLElement, unknown>("body").select(".scatter-tooltip-story");
    if (tip.empty()) {
        tip = d3.select("body")
            .append("div")
            .attr("class", "scatter-tooltip-story")
            .style("position", "absolute")
            .style("background", "rgba(255,255,255,0.95)")
            .style("padding", "8px 12px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("opacity", "0")
            .style("font-size", "11px")
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
            .style("white-space", "nowrap")
            .style("z-index", "1050");
    }
    const fmtComma = d3.format(",");

    // ─── Plot points ─────────────────────────────────────────────
    g.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d[xKey]))
        .attr("cy", d => y(d[yKey]))
        .attr("r",  d => r(d[popKey]))
        .attr("fill", d => palette[regionOf(d.Country)])
        .attr("opacity", 0.8)
        .on("mouseover", (e, d) => {
            tip.transition().duration(100).style("opacity", 0.9);
            tip.html(
                `<strong>${d.Country}</strong><br/>
           Income: $${fmtComma(d[xKey])}<br/>
           Long-hours: ${d[yKey]}%<br/>
           Population: ${d[popKey] ? fmtComma(d[popKey]) : "n/a"}`
            )
                .style("left", (e.pageX + 10) + "px")
                .style("top",  (e.pageY + 10) + "px");
        })
        .on("mousemove", e => {
            tip.style("left", (e.pageX + 10) + "px")
                .style("top",  (e.pageY + 10) + "px");
        })
        .on("mouseout", () => {
            tip.transition().duration(200).style("opacity", 0);
        });

    // ─── Legend (fixed order, centred) ──────────────────────────
    const legendRegions: (keyof typeof palette)[] = ["Europe","Americas","Asia","Oceania"];
    const spacing = 90;
    const legendWidth = legendRegions.length * spacing;
    const legendX = (fullW - m.left - m.right - legendWidth) / 2 + m.left;
    const legendY = fullH - m.bottom + 50;

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX},${legendY})`);

    legend.selectAll("g")
        .data(legendRegions)
        .join("g")
        .attr("transform", (_, i) => `translate(${i * spacing},0)`)
        .call(gL => {
            gL.append("circle")
                .attr("r", 6)
                .attr("fill", d => palette[d]);
            gL.append("text")
                .attr("x", 10)
                .attr("y", 4)
                .style("font-size", "12px")
                .text(d => d);
        });
}
