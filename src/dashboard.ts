import * as d3 from 'd3';

// 1. Configuration & globals
// --- Existing Radar Chart Config (from your colleague) ---
const selectedIndicatorsRadar = [ // Renamed to be specific
    'Housing expenditure', 'Rooms per person', 'Household net adjusted disposable income',
    'Household net wealth', 'Employment rate', 'Personal earnings',
    'Quality of support network', 'Educational attainment', 'Student skills',
    'Life expectancy', 'Self-reported health'
];
const formatIndicatorRadar = (ind: string): string => // Renamed to be specific
    ({
        'Housing expenditure': 'Housing', 'Rooms per person': 'Living space',
        'Household net adjusted disposable income': 'Income', 'Household net wealth': 'Wealth',
        'Employment rate': 'Employment', 'Personal earnings': 'Earnings',
        'Quality of support network': 'Social support', 'Educational attainment': 'Education',
        'Student skills': 'Skills', 'Life expectancy': 'Health',
        'Self-reported health': 'Well-being'
    }[ind] || ind);

// --- Scatter Plot Configuration (NEW) ---
const scatterPlotMargin = { top: 30, right: 30, bottom: 50, left: 60 };
const scatterPlotFullWidth = 750; // Adjust as needed
const scatterPlotFullHeight = 550; // Adjust as needed
const scatterPlotAnimationDuration = 750;
const scatterPlotFixedRadius = 5;
const scatterPlotHighlightColor = "orange"; // Color for highlighted country in scatter
let scatterPlotMasterCountry: string | null = null; // Country to highlight in scatter

let scatterPlotSvg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let scatterPlotG: d3.Selection<SVGGElement, unknown, null, undefined>;

let currentXCategory = "Job satisfaction"; // Default X for scatter
let currentYCategory = "Life satisfaction"; // Default Y for scatter
let shouldScaleByPopulation = false;

let betterlifeindexDataWide: any[] = []; // For scatter plot (original wide format from CSV)
// --- End Scatter Plot Configuration ---


// 2. Load CSV and initialize controls
Promise.all([ d3.csv('/2024BetterLife.csv', d3.autoType) ]).then(([raw]) => {
    betterlifeindexDataWide = raw; // Use 'raw' (wide format) for the scatter plot

    // --- Data Preparation for Radar Chart (Existing logic) ---
    const rawKeys = Object.keys(raw[0]).filter(k => k !== 'Country');
    const radarChartLongData = raw.flatMap(row => // Use a distinct name
        rawKeys.map(key => ({
            Country: row.Country as string,
            Indicator: key.trim(),
            Value: +(row as any)[key]
        }))
    );
    const extentByIndicatorRadar = new Map<string,[number,number]>();
    for (const ind of selectedIndicatorsRadar) {
        const vals = radarChartLongData.filter(d => d.Indicator === ind).map(d => d.Value);
        extentByIndicatorRadar.set(ind, [d3.min(vals)!, d3.max(vals)!]);
    }
    // --- End Radar Data Prep ---

    // --- Common Country Selector Setup ---
    const countrySelect = document.getElementById('country-select') as HTMLSelectElement;
    const countries = Array.from(new Set(betterlifeindexDataWide.map(d => d.Country))).sort();
    countrySelect.innerHTML = countries.map(c => `<option value="${c}">${c}</option>`).join('');
    if (countries.length > 0) {
        countrySelect.value = countries[0];
        scatterPlotMasterCountry = countries[0]; // Initial highlight for scatter
    }

    // --- Scatter Plot Controls Setup ---
    const xAxisSelect = document.getElementById('x-axis-select') as HTMLSelectElement;
    const yAxisSelect = document.getElementById('y-axis-select') as HTMLSelectElement;
    const scalePopCheckbox = document.getElementById('scale-population-checkbox') as HTMLInputElement;

    if (betterlifeindexDataWide.length > 0) {
        const numericKeys = Object.keys(betterlifeindexDataWide[0]).filter(key =>
            key !== "Country" && key !== "Population" && key !== "Flag" && // Assuming 'Flag' might exist
            typeof betterlifeindexDataWide[0][key] === 'number'
        );
        numericKeys.forEach(key => {
            xAxisSelect.add(new Option(key, key));
            yAxisSelect.add(new Option(key, key));
        });
        xAxisSelect.value = currentXCategory;
        yAxisSelect.value = currentYCategory;
    }
    scalePopCheckbox.checked = shouldScaleByPopulation;

    // --- Setup SVGs (Call once for each chart's container) ---
    setupScatterPlotSVG('#scatter-plot-container'); // Target the new div for scatter plot
    // The radar chart's SVG is typically created/cleared within its own render function.

    // --- Event Listeners ---
    // Scatter Plot controls
    xAxisSelect.addEventListener('change', (event) => {
        currentXCategory = (event.target as HTMLSelectElement).value;
        renderScatterPlot();
    });
    yAxisSelect.addEventListener('change', (event) => {
        currentYCategory = (event.target as HTMLSelectElement).value;
        renderScatterPlot();
    });
    scalePopCheckbox.addEventListener('change', (event) => {
        shouldScaleByPopulation = (event.target as HTMLInputElement).checked;
        renderScatterPlot();
    });

    // Common Country Selector
    countrySelect.addEventListener('change', () => {
        const selectedCountryValue = countrySelect.value;
        scatterPlotMasterCountry = selectedCountryValue; // Update for scatter plot highlight

        renderScatterPlot(); // Re-render scatter plot
        renderRadarChart(radarChartLongData, extentByIndicatorRadar, selectedCountryValue); // Re-render radar chart
    });

    // --- Initial Render for Both Charts ---
    renderScatterPlot();
    if (countries.length > 0) {
        renderRadarChart(radarChartLongData, extentByIndicatorRadar, countries[0]);
    }
});


// 3. Chart Rendering Functions

// --- SCATTER PLOT SVG SETUP FUNCTION ---
function setupScatterPlotSVG(containerSelector: string) {
    scatterPlotSvg = d3.select(containerSelector)
        .append('svg')
        .attr('width', scatterPlotFullWidth)
        .attr('height', scatterPlotFullHeight)
        .attr('viewBox', `0 0 ${scatterPlotFullWidth} ${scatterPlotFullHeight}`)
        .attr('style', 'max-width: 100%; height: auto; background: #f9f9f9; font-family: Raleway, sans-serif; border: 1px solid #ddd;'); // Added some subtle styling

    scatterPlotG = scatterPlotSvg.append('g')
        .attr('class', 'drawing-area')
        .attr('transform', `translate(${scatterPlotMargin.left},${scatterPlotMargin.top})`);
}

// --- SCATTER PLOT RENDER FUNCTION ---
function renderScatterPlot() {
    if (!scatterPlotG || !betterlifeindexDataWide.length) { return; }

    const drawingWidth = scatterPlotFullWidth - scatterPlotMargin.left - scatterPlotMargin.right;
    const drawingHeight = scatterPlotFullHeight - scatterPlotMargin.top - scatterPlotMargin.bottom;

    const filteredData = betterlifeindexDataWide.filter(d => {
        const xVal = d[currentXCategory];
        const yVal = d[currentYCategory];
        const popVal = d.Population;
        return typeof xVal === 'number' && !isNaN(xVal) &&
               typeof yVal === 'number' && !isNaN(yVal) &&
               popVal !== undefined && typeof popVal === 'number' && !isNaN(popVal); // Ensure Population is valid
    });

    const xScale = d3.scaleLinear()
        .domain(d3.extent(filteredData, d => d[currentXCategory]) as [number, number]).nice()
        .range([0, drawingWidth]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(filteredData, d => d[currentYCategory]) as [number, number]).nice()
        .range([drawingHeight, 0]);

    const popDomain = d3.extent(filteredData, d => d.Population) as [number, number];
    const radiusScale = d3.scaleSqrt()
        .domain(popDomain[0] !== undefined && popDomain[1] !== undefined ? popDomain : [0, 1]) // Check both ends of domain
        .range([3, 40]);

    // Axes
    let xAxisGroup = scatterPlotG.select<SVGGElement>("g.x-axis");
    if (xAxisGroup.empty()) {
        xAxisGroup = scatterPlotG.append("g").attr("class", "x-axis");
    }
    xAxisGroup
      .attr("transform", `translate(0,${drawingHeight})`)
      .transition().duration(scatterPlotAnimationDuration)
      .call(d3.axisBottom(xScale));

    let yAxisGroup = scatterPlotG.select<SVGGElement>("g.y-axis");
    if (yAxisGroup.empty()) {
        yAxisGroup = scatterPlotG.append("g").attr("class", "y-axis");
    }
    yAxisGroup
      .transition().duration(scatterPlotAnimationDuration)
      .call(d3.axisLeft(yScale));

    // Axis Labels
    let xLabel = scatterPlotG.select<SVGTextElement>("text.x-label");
    if (xLabel.empty()) {
        xLabel = scatterPlotG.append("text").attr("class", "x-label")
            .attr("text-anchor", "middle").attr("fill", "black").style("font-size", "12px");
    }
    xLabel.attr("x", drawingWidth / 2).attr("y", drawingHeight + scatterPlotMargin.bottom - 10).text(currentXCategory);

    let yLabel = scatterPlotG.select<SVGTextElement>("text.y-label");
    if (yLabel.empty()) {
        yLabel = scatterPlotG.append("text").attr("class", "y-label")
            .attr("text-anchor", "middle").attr("fill", "black").style("font-size", "12px").attr("transform", "rotate(-90)");
    }
    yLabel.attr("x", -drawingHeight / 2).attr("y", -scatterPlotMargin.left + 15).text(currentYCategory);

    // Tooltip
    let tooltip = d3.select("body").select<HTMLDivElement>(".scatter-tooltip-external");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "scatter-tooltip-external")
            .style("position", "absolute").style("background", "rgba(255, 255, 255, 0.95)")
            .style("padding", "8px 12px").style("border", "1px solid #ccc").style("border-radius", "4px")
            .style("pointer-events", "none").style("opacity", 0).style("font-size", "11px")
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)").style("white-space", "nowrap").style("z-index", "1050");
    }

    // Circles
    const circles = scatterPlotG.selectAll<SVGCircleElement, any>("circle.data-circle")
        .data(filteredData, (d: any) => d.Country);

    circles.join(
        enter => enter.append("circle")
            .attr("class", "data-circle")
            .attr("fill", d => d.Country === scatterPlotMasterCountry ? scatterPlotHighlightColor : "#007acc")
            .attr("fill-opacity", d => d.Country === scatterPlotMasterCountry ? 1.0 : 0.6)
            .attr("stroke", d => d.Country === scatterPlotMasterCountry ? "black" : "none")
            .attr("cx", d => xScale(d[currentXCategory]))
            .attr("cy", d => yScale(d[currentYCategory]))
            .attr("r", 0)
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr("r", d => shouldScaleByPopulation ? radiusScale(d.Population) : scatterPlotFixedRadius)),
        update => update
            .attr("fill", d => d.Country === scatterPlotMasterCountry ? scatterPlotHighlightColor : "#007acc")
            .attr("fill-opacity", d => d.Country === scatterPlotMasterCountry ? 1.0 : 0.6)
            .attr("stroke", d => d.Country === scatterPlotMasterCountry ? "black" : "none")
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr("cx", d => xScale(d[currentXCategory]))
                .attr("cy", d => yScale(d[currentYCategory]))
                .attr("r", d => shouldScaleByPopulation ? radiusScale(d.Population) : scatterPlotFixedRadius)),
        exit => exit
            .call(s => s.transition().duration(scatterPlotAnimationDuration).attr("r", 0).remove())
    )
    .on("mouseover", (event, d: any) => {
        tooltip.transition().duration(100).style("opacity", 0.9);
        const formatComma = d3.format(",");
        tooltip.html(`<strong>${d.Country} ${d.Flag || ''}</strong><br>
                      ${currentXCategory}: ${d[currentXCategory]}<br>
                      ${currentYCategory}: ${d[currentYCategory]}<br>
                      Population: ${formatComma(d.Population)}`)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 20}px`);
        d3.select(event.currentTarget).raise();
    })
    .on("mouseout", () => {
        tooltip.transition().duration(200).style("opacity", 0);
    });
}

// --- RADAR CHART RENDER FUNCTION (Your colleague's code, renamed for clarity) ---
// Make sure it's using selectedIndicatorsRadar and formatIndicatorRadar
function renderRadarChart(
    data: { Country: string; Indicator: string; Value: number }[], // This is radarChartLongData
    extents: Map<string, [number, number]>,                        // This is extentByIndicatorRadar
    selectedCountry: string
) {
    d3.select('#chart').selectAll('*').remove(); // Clears the radar chart's specific container

    const oecdAverages = Object.fromEntries(
        selectedIndicatorsRadar.map(ind => { // Use radar-specific indicators
            const vals = data.filter(d => d.Indicator === ind).map(d => d.Value);
            return [ind, d3.mean(vals)!];
        })
    );

    const radarData = selectedIndicatorsRadar.flatMap(ind => { // Use radar-specific indicators
        const [lo, hi] = extents.get(ind)!;
        const scale = d3.scaleLinear([lo, hi], [0, 10]);
        const selVal = data.find(d => d.Country === selectedCountry && d.Indicator === ind)?.Value ?? lo;
        return [
            { country: selectedCountry, indicator: ind, value: scale(selVal) },
            { country: 'OECD', indicator: ind, value: scale(oecdAverages[ind]) }
        ];
    });

    const radarMargin = { top: 50, right: 100, bottom: 50, left: 100 };
    const W = 700, H = 600; // Dimensions for Radar Chart SVG
    const R = Math.min(W - radarMargin.left - radarMargin.right, H - radarMargin.top - radarMargin.bottom) / 2;
    const angle = 2 * Math.PI / selectedIndicatorsRadar.length; // Use radar-specific indicators
    const levels = 5;

    const svgRadar = d3.select('#chart') // Targets the original div for radar chart
        .append('svg')
        .attr('width', W)
        .attr('height', H)
        .attr('viewBox', `0 0 ${W} ${H}`)
        .style('background', 'var(--color-white)')
        .style('font-family', 'Raleway, sans-serif');

    const gRadar = svgRadar.append('g')
        .attr('transform', `translate(${W / 2},${H / 2})`);

    for (let i = 1; i <= levels; ++i) {
        gRadar.append('circle').attr('r', R * i / levels).attr('fill', 'none').attr('stroke', '#ccc');
    }

    selectedIndicatorsRadar.forEach((ind, i) => { // Use radar-specific indicators
        const a = i * angle - Math.PI / 2;
        const x_ax = R * Math.cos(a), y_ax = R * Math.sin(a);
        gRadar.append('line').attr('x1', 0).attr('y1', 0).attr('x2', x_ax).attr('y2', y_ax).attr('stroke', '#999');
        gRadar.append('text')
            .attr('x', (R + 20) * Math.cos(a))
            .attr('y', (R + 20) * Math.sin(a))
            .attr('dy', ((a > Math.PI / 2 && a < 3 * Math.PI / 2) || (a < -Math.PI/2 && a > -3*Math.PI/2) ) ? '1em' : '0.35em') // Refined dy
            .attr('text-anchor', Math.abs(Math.cos(a)) < 0.01 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end')) // Refined anchor
            .style('font-size', '12px')
            .text(formatIndicatorRadar(ind)); // Use radar-specific formatter
    });

    const rScaleRadar = d3.scaleLinear([0, 10], [0, R]);
    const radarLineGen = d3.lineRadial<any>()
        .radius(d => rScaleRadar(d.value))
        .angle((_, i) => i * angle)
        .curve(d3.curveLinearClosed);

    const byCountryRadar = d3.group(radarData, d => d.country);
    const colorRadar = d3.scaleOrdinal<string>()
        .domain([selectedCountry, 'OECD'])
        .range(['#e41a1c', '#4daf4a']);

    for (const [country, pts] of byCountryRadar) {
        const ordered = selectedIndicatorsRadar.map(ind => pts.find(p => p.indicator === ind)!); // Use radar-specific indicators
        if(ordered.some(p => p === undefined)) { // Check if all points found
            console.warn(`Missing indicator data for ${country} in radar chart. Points:`, pts, "Indicators:", selectedIndicatorsRadar);
            continue;
        }
        gRadar.append('path')
            .datum(ordered)
            .attr('d', radarLineGen as any)
            .attr('fill', colorRadar(country))
            .attr('fill-opacity', 0.2)
            .attr('stroke', colorRadar(country))
            .attr('stroke-width', 2);
        ordered.forEach((d, i) => {
            if (d === undefined) return; // Skip if point is missing
            const a = i * angle - Math.PI / 2;
            const r_pt = rScaleRadar(d.value);
            gRadar.append('circle')
                .attr('cx', r_pt * Math.cos(a))
                .attr('cy', r_pt * Math.sin(a))
                .attr('r', 4)
                .attr('fill', colorRadar(country));
        });
    }

    const legendRadar = svgRadar.append('g')
        .attr('transform', `translate(${W - radarMargin.right + 20},${radarMargin.top})`);
    [selectedCountry, 'OECD'].forEach((c, i) => {
        const lg = legendRadar.append('g').attr('transform', `translate(0,${25 * i})`);
        lg.append('line').attr('x1', 0).attr('y1', 10).attr('x2', 30).attr('y2', 10).attr('stroke', colorRadar(c)).attr('stroke-width', 2);
        lg.append('circle').attr('cx', 15).attr('cy', 10).attr('r', 4).attr('fill', colorRadar(c));
        lg.append('text').attr('x', 40).attr('y', 10).attr('dy', '0.35em').style('font-size', '12px').text(c);
    });
}