import * as d3 from 'd3';

// ── Configuration ───────────────────────────────────────────
// Radar (from File 2 / previous combined)
const selectedIndicatorsRadar = [
    'Housing expenditure','Rooms per person','Household net adjusted disposable income',
    'Household net wealth','Employment rate','Personal earnings',
    'Quality of support network','Educational attainment','Student skills',
    'Life expectancy','Self-reported health'
];
const formatIndicatorRadar = (ind: string): string => ({
    'Housing expenditure':'Housing','Rooms per person':'Living space',
    'Household net adjusted disposable income':'Income','Household net wealth':'Wealth',
    'Employment rate':'Employment','Personal earnings':'Earnings',
    'Quality of support network':'Social support','Educational attainment':'Education',
    'Student skills':'Skills','Life expectancy':'Health','Self-reported health':'Well-being'
}[ind] || ind);

// Scatter Plot (from File 2 / previous combined)
const scatterPlotMargin = { top: 30, right: 30, bottom: 50, left: 60 };
const scatterPlotFullWidth = 750;
const scatterPlotFullHeight = 550;
const scatterPlotAnimationDuration = 750;
const scatterPlotFixedRadius = 5;
const scatterPlotHighlightColor = "orange";
let scatterPlotMasterCountry: string | null = null;
let scatterPlotSvg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let scatterPlotG: d3.Selection<SVGGElement, unknown, null, undefined>;
let currentXCategory = "Job satisfaction";
let currentYCategory = "Life satisfaction";
let shouldScaleByPopulation = false;
let betterlifeindexDataWide: any[] = [];

// Bar Chart config (from previous combined)
const barMargin = { top: 40, right: 20, bottom: 60, left: 80 };
const barFullWidth = 900;
const barFullHeight = 500;
let barSvg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let barG: d3.Selection<SVGGElement, unknown, null, undefined>;

// ── Load & Initialize ───────────────────────────────────────
Promise.all([ d3.csv('/2024BetterLife.csv', d3.autoType) ]).then(([raw]) => {
    if (!raw || raw.length === 0) {
        console.error("Failed to load or data is empty.");
        return;
    }
    betterlifeindexDataWide = raw;

    // --- Data Preparation for Radar Chart (from File 2 / previous combined) ---
    const rawKeys = Object.keys(raw[0]).filter(k => k !== 'Country');
    const radarChartLongData = raw.flatMap(row =>
        rawKeys.map(key => ({
            Country: row.Country as string,
            Indicator: key.trim(),
            Value: +(row as any)[key]
        }))
    );
    const extentByIndicatorRadar = new Map<string,[number,number]>();
    for (const ind of selectedIndicatorsRadar) {
        const vals = radarChartLongData.filter(d => d.Indicator===ind && typeof d.Value === 'number' && !isNaN(d.Value)).map(d=>d.Value);
        if (vals.length > 0) {
            extentByIndicatorRadar.set(ind, [d3.min(vals)!, d3.max(vals)!]);
        } else {
            extentByIndicatorRadar.set(ind, [0,0]); // Default extent if no valid data
            console.warn(`No valid data for radar indicator: ${ind}`);
        }
    }

    // --- Common Country Selector Setup (Vanilla JS from File 2) ---
    const countrySelect = document.getElementById('country-select') as HTMLSelectElement;
    const countries = Array.from(new Set(betterlifeindexDataWide.map(d => d.Country as string))).sort();
    if (countrySelect) {
        countrySelect.innerHTML = countries.map(c => `<option value="${c}">${c}</option>`).join('');
        if (countries.length > 0) {
            countrySelect.value = countries[0];
            scatterPlotMasterCountry = countries[0];
        }
    } else {
        console.error("Country select element not found.");
    }


    // --- Scatter Plot Controls Setup (Vanilla JS from File 2) ---
    const xAxisSelect = document.getElementById('x-axis-select') as HTMLSelectElement;
    const yAxisSelect = document.getElementById('y-axis-select') as HTMLSelectElement;
    const scalePopCheckbox = document.getElementById('scale-population-checkbox') as HTMLInputElement;

    const numericKeys = Object.keys(raw[0]).filter(key =>
        key !== "Country" && key !== "Population" && key !== "Flag" &&
        typeof (raw[0] as any)[key] === 'number'
    );

    if (xAxisSelect && yAxisSelect) {
        numericKeys.forEach(key => {
            xAxisSelect.add(new Option(key, key));
            yAxisSelect.add(new Option(key, key));
        });
        xAxisSelect.value = currentXCategory;
        yAxisSelect.value = currentYCategory;
    } else {
        console.error("Scatter axis select elements not found.");
    }
    if (scalePopCheckbox) {
        scalePopCheckbox.checked = shouldScaleByPopulation;
    } else {
        console.error("Scale population checkbox not found.");
    }


    // --- Bar Chart Controls Setup (D3.js from previous combined) ---
    const propertySelect = d3.select<HTMLSelectElement>('#property-select');
    const numSelect = d3.select<HTMLSelectElement>('#num-select');
    const numGroup = d3.select<HTMLDivElement>('#num-select-group');
    const continentCheckbox = d3.select<HTMLInputElement>('#continent-mode');

    if (!propertySelect.empty()) {
        numericKeys.forEach(k => {
            propertySelect.append('option').attr('value', k).text(k);
        });
        if (numericKeys.length > 0) {
            propertySelect.property('value', numericKeys[0]);
        }
    } else {
        console.error("Bar chart property select not found.");
    }

    if (!numSelect.empty()) {
        ['Top 3','Top 5','Top 10','Top 15','All'].forEach(o =>
            numSelect.append('option').attr('value', o).text(o)
        );
    } else {
        console.error("Bar chart num select not found.");
    }


    // Setup SVGs
    setupScatterPlotSVG('#scatter-plot-container');
    setupBarChartSVG('#bar-chart'); // Radar SVG setup is inside its render function

    // --- Event Listeners ---
    // Common Country Selector (Vanilla JS from File 2)
    if (countrySelect) {
        countrySelect.addEventListener('change', () => {
            const selectedCountryValue = countrySelect.value;
            scatterPlotMasterCountry = selectedCountryValue;
            renderScatterPlot();
            if (selectedCountryValue) {
                renderRadarChart(radarChartLongData, extentByIndicatorRadar, selectedCountryValue);
            }
        });
    }

    // Scatter Plot controls (Vanilla JS from File 2)
    if (xAxisSelect) {
        xAxisSelect.addEventListener('change', (event) => {
            currentXCategory = (event.target as HTMLSelectElement).value;
            renderScatterPlot();
        });
    }
    if (yAxisSelect) {
        yAxisSelect.addEventListener('change', (event) => {
            currentYCategory = (event.target as HTMLSelectElement).value;
            renderScatterPlot();
        });
    }
    if (scalePopCheckbox) {
        scalePopCheckbox.addEventListener('change', (event) => {
            shouldScaleByPopulation = (event.target as HTMLInputElement).checked;
            renderScatterPlot();
        });
    }

    // Bar chart controls (D3.js from previous combined)
    if (!continentCheckbox.empty()) {
        continentCheckbox.on('change', () => {
            const on = continentCheckbox.property('checked');
            if (!numGroup.empty()) {
                numGroup.style('display', on ? 'none' : null);
            }
            renderBarChart();
        });
    } else {
        console.error("Bar chart continent checkbox not found.");
    }
    if (!numSelect.empty()) {
        numSelect.on('change', renderBarChart);
    }
    if (!propertySelect.empty()) {
        propertySelect.on('change', renderBarChart);
    }

    // Initial render
    renderScatterPlot();
    if (scatterPlotMasterCountry) {
        renderRadarChart(radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry);
    }
    renderBarChart();
});

// --- SCATTER PLOT SVG SETUP FUNCTION (from File 2 / previous combined) ---
function setupScatterPlotSVG(containerSelector: string) {
    const container = d3.select(containerSelector);
    if (container.empty()){
        console.error(`Scatter plot container ${containerSelector} not found.`);
        return;
    }
    scatterPlotSvg = container
        .append('svg')
        .attr('width', scatterPlotFullWidth)
        .attr('height', scatterPlotFullHeight)
        .attr('viewBox', `0 0 ${scatterPlotFullWidth} ${scatterPlotFullHeight}`)
        .attr('style', 'max-width: 100%; height: auto; background: #f9f9f9; font-family: Raleway, sans-serif; border: 1px solid #ddd;');

    scatterPlotG = scatterPlotSvg.append('g')
        .attr('class', 'drawing-area')
        .attr('transform', `translate(${scatterPlotMargin.left},${scatterPlotMargin.top})`);
}

// --- SCATTER PLOT RENDER FUNCTION (from File 2 / previous combined) ---
function renderScatterPlot() {
    if (!scatterPlotG || !betterlifeindexDataWide.length) {
        if (!scatterPlotG) console.log("scatterPlotG not ready for renderScatterPlot");
        if (!betterlifeindexDataWide.length) console.log("betterlifeindexDataWide is empty for renderScatterPlot");
        return;
    }

    const drawingWidth = scatterPlotFullWidth - scatterPlotMargin.left - scatterPlotMargin.right;
    const drawingHeight = scatterPlotFullHeight - scatterPlotMargin.top - scatterPlotMargin.bottom;

    const filteredData = betterlifeindexDataWide.filter(d => {
        const xVal = d[currentXCategory];
        const yVal = d[currentYCategory];
        const popVal = d.Population;
        return typeof xVal === 'number' && !isNaN(xVal) &&
            typeof yVal === 'number' && !isNaN(yVal) &&
            popVal !== undefined && typeof popVal === 'number' && !isNaN(popVal);
    });

    if (filteredData.length === 0) {
        console.warn("Scatter plot: No data to render after filtering for selected categories.");
        scatterPlotG.selectAll("*").remove(); // Clear previous drawing
        return;
    }

    const xScale = d3.scaleLinear()
        .domain(d3.extent(filteredData, d => d[currentXCategory]) as [number, number]).nice()
        .range([0, drawingWidth]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(filteredData, d => d[currentYCategory]) as [number, number]).nice()
        .range([drawingHeight, 0]);

    const popDomain = d3.extent(filteredData, d => d.Population) as [number, number];
    const radiusScale = d3.scaleSqrt()
        .domain(popDomain[0] !== undefined && popDomain[1] !== undefined ? popDomain : [0, 1])
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
        .data(filteredData, (d: any) => d.Country as string);

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

// --- RADAR CHART RENDER FUNCTION (from File 2 / previous combined) ---
function renderRadarChart(
    data: { Country: string; Indicator: string; Value: number }[],
    extents: Map<string, [number, number]>,
    selectedCountry: string
) {
    const chartContainer = d3.select('#chart');
    if (chartContainer.empty()){
        console.error("Radar chart container #chart not found.");
        return;
    }
    chartContainer.selectAll('*').remove();

    const oecdAverages = Object.fromEntries(
        selectedIndicatorsRadar.map(ind => {
            const vals = data.filter(d => d.Indicator === ind && typeof d.Value === 'number' && !isNaN(d.Value)).map(d => d.Value);
            return [ind, vals.length > 0 ? d3.mean(vals)! : 0]; // Default to 0 if no valid data for average
        })
    );

    const radarData = selectedIndicatorsRadar.flatMap(ind => {
        const extentPair = extents.get(ind);
        if (!extentPair) {
            console.warn(`Extent not found for indicator: ${ind}`);
            return []; // Skip this indicator if extent is missing
        }
        const [lo, hi] = extentPair;
        const scale = (lo === hi) ? d3.scaleLinear([lo -1, hi + 1], [0,10]) : d3.scaleLinear([lo, hi], [0, 10]); // Handle lo === hi case for scale

        const selectedRow = data.find(d => d.Country === selectedCountry && d.Indicator === ind);
        const selVal = (selectedRow && typeof selectedRow.Value === 'number' && !isNaN(selectedRow.Value)) ? selectedRow.Value : lo;

        return [
            { country: selectedCountry, indicator: ind, value: scale(selVal) },
            { country: 'OECD', indicator: ind, value: scale(oecdAverages[ind]) }
        ];
    });

    if (radarData.length === 0) {
        console.warn("No data to render for radar chart.");
        return;
    }

    const radarMargin = { top: 50, right: 100, bottom: 50, left: 100 };
    const W = 700, H = 600;
    const R = Math.min(W - radarMargin.left - radarMargin.right, H - radarMargin.top - radarMargin.bottom) / 2;
    const angle = 2 * Math.PI / selectedIndicatorsRadar.length;
    const levels = 5;

    const svgRadar = chartContainer
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

    selectedIndicatorsRadar.forEach((ind, i) => {
        const a = i * angle - Math.PI / 2;
        const x_ax = R * Math.cos(a), y_ax = R * Math.sin(a);
        gRadar.append('line').attr('x1', 0).attr('y1', 0).attr('x2', x_ax).attr('y2', y_ax).attr('stroke', '#999');
        gRadar.append('text')
            .attr('x', (R + 20) * Math.cos(a))
            .attr('y', (R + 20) * Math.sin(a))
            .attr('dy', ((a > Math.PI / 2 && a < 3 * Math.PI / 2) || (a < -Math.PI/2 && a > -3*Math.PI/2) ) ? '1em' : '0.35em')
            .attr('text-anchor', Math.abs(Math.cos(a)) < 0.01 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'))
            .style('font-size', '12px')
            .text(formatIndicatorRadar(ind));
    });

    const rScaleRadar = d3.scaleLinear([0, 10], [0, R]);
    const radarLineGen = d3.lineRadial<{indicator: string, value: number}>()
        .radius(d => rScaleRadar(d.value))
        .angle((_, i) => i * angle) // i is index in ordered array
        .curve(d3.curveLinearClosed);

    const byCountryRadar = d3.group(radarData, d => d.country);
    const colorRadar = d3.scaleOrdinal<string>()
        .domain([selectedCountry, 'OECD'])
        .range(['#e41a1c', '#4daf4a']);

    for (const [countryName, pts] of byCountryRadar) {
        const ordered = selectedIndicatorsRadar.map(ind => pts.find(p => p.indicator === ind)! );
        if(ordered.some(p => p === undefined)) {
            console.warn(`Missing indicator data for ${countryName} in radar chart. Points:`, pts, "Indicators:", selectedIndicatorsRadar);
            continue;
        }
        gRadar.append('path')
            .datum(ordered as {indicator: string, value: number}[]) // Cast for lineRadial
            .attr('d', radarLineGen)
            .attr('fill', colorRadar(countryName))
            .attr('fill-opacity', 0.2)
            .attr('stroke', colorRadar(countryName))
            .attr('stroke-width', 2);
        ordered.forEach((d, i) => {
            if (d === undefined) return;
            const a = i * angle - Math.PI / 2; // Use index from ordered array
            const r_pt = rScaleRadar(d.value);
            gRadar.append('circle')
                .attr('cx', r_pt * Math.cos(a))
                .attr('cy', r_pt * Math.sin(a))
                .attr('r', 4)
                .attr('fill', colorRadar(countryName));
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

// ── BAR CHART SETUP & RENDER (from previous combined) ───────────────────
function setupBarChartSVG(selector: string) {
    const container = d3.select(selector);
    if (container.empty()){
        console.error(`Bar chart container ${selector} not found.`);
        return;
    }
    barSvg = container.append('svg')
        .attr('width', barFullWidth)
        .attr('height', barFullHeight)
        .style('max-width','100%').style('height','auto');
    barG = barSvg.append('g')
        .attr('transform', `translate(${barMargin.left},${barMargin.top})`);
}

function renderBarChart() {
    if (!barG || !betterlifeindexDataWide.length) {
        if (!barG) console.log("barG not ready for renderBarChart");
        if (!betterlifeindexDataWide.length) console.log("betterlifeindexDataWide is empty for renderBarChart");
        return;
    }

    const continentModeCheckbox = d3.select<HTMLInputElement>('#continent-mode');
    const numSelect = d3.select<HTMLSelectElement>('#num-select');
    const propertySelect = d3.select<HTMLSelectElement>('#property-select');

    // Read controls safely
    const continentMode = continentModeCheckbox.empty() ? false : continentModeCheckbox.property('checked');
    const numVal = numSelect.empty() ? 'Top 10' : numSelect.property('value');
    const prop = propertySelect.empty() ? (numericKeys.length > 0 ? numericKeys[0] : null) : propertySelect.property('value');

    if (!prop) {
        console.warn("Bar chart: No property selected or available.");
        barG.selectAll("*").remove();
        return;
    }

    const dataForProp = betterlifeindexDataWide.filter(d => typeof d[prop] === 'number' && !isNaN(d[prop]));
    if (dataForProp.length === 0) {
        console.warn(`Bar chart: No valid data for property ${prop}.`);
        barG.selectAll("*").remove();
        return;
    }


    const grouped = continentMode
        ? d3.rollup(dataForProp, v=>d3.mean(v, d=>d[prop])!, d=>regionOf(d.Country as string))
        : d3.rollup(dataForProp, v=>d3.mean(v, d=>d[prop])!, d=>d.Country as string);

    let entries = Array.from(grouped.entries())
        .map(([k,v])=>({key:k, value: (v === undefined || isNaN(v)) ? 0 : v})) // Handle undefined/NaN from mean
        .filter(d => d.value !== null && d.value !== undefined); // ensure value is not null/undefined

    entries.sort((a,b)=>d3.descending(a.value,b.value));

    if (!continentMode) {
        if (numVal.startsWith('Top ')) {
            const n = +numVal.split(' ')[1];
            entries = entries.slice(0,n);
        }
    }

    if (entries.length === 0) {
        console.warn("Bar chart: No entries to display after processing.");
        barG.selectAll("*").remove();
        return;
    }


    barG.selectAll('*').remove();

    const width = barFullWidth - barMargin.left - barMargin.right;
    const height = barFullHeight - barMargin.top - barMargin.bottom;

    const maxValue = d3.max(entries, d=>d.value);
    if (maxValue === undefined) {
        console.warn("Bar chart: Max value is undefined. Cannot render.");
        return;
    }


    const vertical = continentMode || ['Top 3','Top 5'].includes(numVal);

    if (vertical) {
        const xBand = d3.scaleBand()
            .domain(entries.map(d=>d.key))
            .range([0,width])
            .padding(0.1);
        const yLin = d3.scaleLinear()
            .domain([0, maxValue]).nice()
            .range([height,0]);

        barG.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xBand))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
        barG.append('g')
            .call(d3.axisLeft(yLin));

        barG.selectAll('rect.bar-rect')
            .data(entries)
            .join('rect')
            .attr('class', 'bar-rect')
            .attr('x', d=>xBand(d.key)!)
            .attr('width', xBand.bandwidth())
            .attr('y', d=>yLin(d.value))
            .attr('height', d=>height - yLin(d.value))
            .attr('fill', '#69b3a2');
    } else {
        const xLin = d3.scaleLinear()
            .domain([0, maxValue]).nice()
            .range([0,width]);
        const yBand = d3.scaleBand()
            .domain(entries.map(d=>d.key))
            .range([0,height])
            .padding(0.1);

        barG.append('g')
            .call(d3.axisLeft(yBand));
        barG.append('g') // Top axis for horizontal bars
            .attr('transform', `translate(0,0)`)
            .call(d3.axisTop(xLin).ticks(width / 80));


        barG.selectAll('rect.bar-rect')
            .data(entries)
            .join('rect')
            .attr('class', 'bar-rect')
            .attr('y', d=>yBand(d.key)!)
            .attr('height', yBand.bandwidth())
            .attr('x', 0)
            .attr('width', d=>xLin(d.value))
            .attr('fill', '#404080');
    }
}

// ── Helpers (from previous combined) ────────────────────────────────────
function regionOf(country: string): string {
    const eu = ["Austria","Belgium","Czechia","Denmark","Estonia","Finland",
        "France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Latvia",
        "Lithuania","Luxembourg","Netherlands","Norway","Poland","Portugal",
        "Slovak Republic","Slovenia","Spain","Sweden","Switzerland","Türkiye",
        "United Kingdom", "European Union (27 countries)"]; // Added EU aggregate
    const am = ["Canada","Chile","Colombia","Costa Rica","Mexico","United States"];
    const as = ["Israel","Japan","Korea"];
    const oc = ["Australia","New Zealand"];
    const af = ["South Africa"]; // Added for completeness if data exists

    if (eu.includes(country)) return "Europe";
    if (am.includes(country)) return "Americas";
    if (as.includes(country)) return "Asia";
    if (oc.includes(country)) return "Oceania";
    if (af.includes(country)) return "Africa";

    // Default for aggregates or unclassified
    if (country.toLowerCase().includes("oecd") || country.toLowerCase().includes("total")) return "OECD Average";
    return "Other"; // Default region
}