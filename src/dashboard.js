import * as d3 from 'd3';

// 1. Configuration & globals
// --- Radar Chart Config ---
const selectedIndicatorsRadar = [
    'Housing expenditure', 'Rooms per person',
    'Household net adjusted disposable income',
    'Household net wealth', 'Employment rate',
    'Personal earnings', 'Quality of support network',
    'Educational attainment', 'Student skills',
    'Life expectancy', 'Self-reported health'
];
const formatIndicatorRadar = (ind) => ({
    'Housing expenditure': 'Housing',
    'Rooms per person': 'Living space',
    'Household net adjusted disposable income': 'Income',
    'Household net wealth': 'Wealth',
    'Employment rate': 'Employment',
    'Personal earnings': 'Earnings',
    'Quality of support network': 'Social support',
    'Educational attainment': 'Education',
    'Student skills': 'Skills',
    'Life expectancy': 'Health',
    'Self-reported health': 'Well-being'
}[ind] || ind);

// --- Scatter Plot Config & Globals ---
const scatterPlotAnimationDuration = 750;
const scatterPlotFixedRadius = 5;

const continentPalette = {
    Europe: "#1f77b4",
    Americas: "#ff7f0e",
    Asia: "#2ca02c",
    Oceania: "#d62728",
    Africa: "#9467bd",
    "OECD Average": "#8c564b",
    Other: "#7f7f7f"
};

let scatterPlotSvg;
let scatterPlotG;
let betterlifeindexDataWide = [];
let scatterPlotMasterCountry = null;
let currentXCategory = 'GDP per capita (USD)';
let currentYCategory = 'Life satisfaction';
let shouldScaleByPopulation = false;

// --- Bar Chart Config & Globals ---
let barSvg;
let barG;
let numericKeys = [];

// --- Color Palette from UI Design ---
const UI_COLORS = {
    primary: "#005B96",      // primary blue
    accent: "#74B3CE",       // accent blue
    grayDark: "#444444",     // gray-dark
    grayMid: "#888888",      // gray-mid
    grayLight: "#E0E0E0",    // gray-light
    white: "#FFFFFF",        // white
    secondary: "#F5A623"     // secondary orange
};

// --- Bar Chart Color Configuration ---
const BAR_CHART_COLORS = {
    default: UI_COLORS.primary,           // Use primary blue for all bars
    selected: UI_COLORS.secondary,        // Use secondary orange for selected country
    selectedStroke: UI_COLORS.grayDark,   // Dark border for selected country
    continent: continentPalette,          // Use continent colors when in continent mode
    // Duller continent colors for bar chart using UI palette
    continentDull: {
        Europe: UI_COLORS.accent,         // Accent blue for Europe
        Americas: "#D4A574",              // Muted orange for Americas
        Asia: "#7BA05B",                  // Muted green for Asia
        Oceania: "#C97064",               // Muted red for Oceania
        Africa: "#9B7CB6",                // Muted purple for Africa
        Other: UI_COLORS.grayMid          // Gray-mid for others
    }
};

// --- Radar Chart Globals ---
let radarSvg;
let radarG;

// 2. Load CSV and initialize controls
d3.csv('/data/2024BetterLife.csv', d3.autoType).then(raw => {
    if (!raw || raw.length === 0) {
        console.error("Failed to load or data is empty.");
        return;
    }
    betterlifeindexDataWide = raw;

    const countries = Array.from(new Set(raw.map(d => d.Country))).sort();

    // --- Common Country Selector ---
    const countrySelect = document.getElementById('country-select');
    if (countrySelect) {
        countrySelect.innerHTML = countries.map(c => `<option value="${c}">${c}</option>`).join('');
        const savedCountry = localStorage.getItem('bli-selected-country');
        if (savedCountry && countries.includes(savedCountry)) {
            countrySelect.value = savedCountry;
            scatterPlotMasterCountry = savedCountry;
        } else if (countries.length > 0) {
            countrySelect.value = countries[0];
            scatterPlotMasterCountry = countries[0];
        }
    } else {
        console.error("Country select element not found.");
    }

    // --- Data Preparation for Radar Chart ---
    const rawKeys = Object.keys(raw[0]).filter(k => k !== 'Country');
    const radarChartLongData = raw.flatMap(row =>
        rawKeys.map(key => ({
            Country: row.Country,
            Indicator: key.trim(),
            Value: +(row[key] || 0)
        }))
    );
    const extentByIndicatorRadar = new Map();
    for (const ind of selectedIndicatorsRadar) {
        const vals = radarChartLongData
            .filter(d => d.Indicator === ind && typeof d.Value === 'number' && !isNaN(d.Value))
            .map(d => d.Value);
        if (vals.length > 0) {
            extentByIndicatorRadar.set(ind, [d3.min(vals), d3.max(vals)]);
        } else {
            extentByIndicatorRadar.set(ind, [0, 0]);
        }
    }

    // --- Scatter Plot Controls ---
    const xAxisSelect = document.getElementById('x-axis-select');
    const yAxisSelect = document.getElementById('y-axis-select');
    const scalePopCheckbox = document.getElementById('scale-population-checkbox');
    numericKeys = Object.keys(raw[0]).filter(k => k !== 'Country' && k !== 'Flag' && k !== 'Population' && typeof raw[0][k] === 'number');
    if (xAxisSelect && yAxisSelect) {
        for (const k of numericKeys) {
            xAxisSelect.add(new Option(k, k));
            yAxisSelect.add(new Option(k, k));
        }
        xAxisSelect.value = currentXCategory;
        yAxisSelect.value = currentYCategory;
    }
    if (scalePopCheckbox) {
        scalePopCheckbox.checked = shouldScaleByPopulation;
    }

    // --- Bar Chart Controls ---
    const propertySelect = document.getElementById('property-select');
    const numSelect = document.getElementById('num-select');
    const continentCheckbox = document.getElementById('continent-mode');
    if (propertySelect) {
        numericKeys.forEach(k => propertySelect.add(new Option(k, k)));
        if (numericKeys.length > 0) propertySelect.value = numericKeys[0];
    }
    if (numSelect) {
        ['Top 3', 'Top 5', 'Top 10', 'Top 15', 'All'].forEach(o => numSelect.add(new Option(o, o)));
        numSelect.value = 'Top 10';
    }

    // Setup SVG containers with responsive sizing
    setupScatterPlotSVG('#scatter-plot-container');
    setupRadarChartSVG('#chart');
    setupBarChartSVG('#bar-chart');

    // Initial Render
    renderScatterPlot();
    if (scatterPlotMasterCountry) {
        renderRadarChart('#chart', radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry);
    }
    renderBarChart();

    // Event Listeners
    if (xAxisSelect) xAxisSelect.onchange = () => { currentXCategory = xAxisSelect.value; renderScatterPlot(); };
    if (yAxisSelect) yAxisSelect.onchange = () => { currentYCategory = yAxisSelect.value; renderScatterPlot(); };
    if (scalePopCheckbox) scalePopCheckbox.onchange = () => { shouldScaleByPopulation = scalePopCheckbox.checked; renderScatterPlot(); };
    if (countrySelect) countrySelect.onchange = () => {
        scatterPlotMasterCountry = countrySelect.value;
        localStorage.setItem('bli-selected-country', scatterPlotMasterCountry);
        renderScatterPlot();
        if (scatterPlotMasterCountry) renderRadarChart('#chart', radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry);
        renderBarChart(); // Re-render bar chart to update highlighting
    };
    if (propertySelect) propertySelect.onchange = () => { renderBarChart(); };
    if (numSelect) numSelect.onchange = () => { renderBarChart(); };
    if (continentCheckbox) continentCheckbox.onchange = () => {
        const numGroup = document.getElementById('num-select-group');
        if (numGroup) numGroup.style.display = continentCheckbox.checked ? 'none' : '';
        renderBarChart();
    };

    // Add resize listener for responsive charts
    window.addEventListener('resize', debounce(() => {
        renderScatterPlot();
        if (scatterPlotMasterCountry) renderRadarChart('#chart', radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry);
        renderBarChart();
    }, 250));

    // Initialize progress indicator functionality
    initProgressIndicator();
});

// 3. Scatter Plot Functions
function setupScatterPlotSVG(selector) {
    const container = d3.select(selector);
    if (container.empty()) { console.error(`Scatter plot container ${selector} not found.`); return; }

    container.selectAll('*').remove();

    scatterPlotSvg = container.append('svg')
        .attr('viewBox', '0 0 900 500') // Increased width for legend
        .attr('style', 'width: 100%; height: 100%; background: #fdfdfd; font-family: Raleway, sans-serif; border-radius: 8px;');

    scatterPlotG = scatterPlotSvg.append('g')
        .attr('transform', 'translate(60,20)');

    // Create persistent axis and label groups
    scatterPlotG.append('g').attr('class', 'x-axis');
    scatterPlotG.append('g').attr('class', 'y-axis');
    scatterPlotG.append('text').attr('class', 'x-label').attr('text-anchor', 'middle').attr('fill','#333').style('font-size','12px').style('font-weight','500');
    scatterPlotG.append('text').attr('class', 'y-label').attr('text-anchor', 'middle').attr('fill','#333').style('font-size','12px').style('font-weight','500').attr('transform','rotate(-90)');
}

function renderScatterPlot() {
    if (!scatterPlotG || !betterlifeindexDataWide.length) return;

    const drawingWidth = 620; // Reduced to make room for legend
    const drawingHeight = 400;
    const margin = { bottom: 60, left: 50 };

    const filteredData = betterlifeindexDataWide.filter(d =>
        typeof d[currentXCategory] === 'number' && !isNaN(d[currentXCategory]) &&
        typeof d[currentYCategory] === 'number' && !isNaN(d[currentYCategory]) &&
        d.Population !== undefined && typeof d.Population === 'number' && !isNaN(d.Population)
    );

    const xScale = d3.scaleLinear().domain(d3.extent(filteredData, d => d[currentXCategory])).nice().range([0, drawingWidth]);
    const yScale = d3.scaleLinear().domain(d3.extent(filteredData, d => d[currentYCategory])).nice().range([drawingHeight, 0]);
    const radiusScale = d3.scaleSqrt().domain(d3.extent(filteredData, d => d.Population)).range([5, 30]); // Updated range like onboarding

    // Animate Axes
    scatterPlotG.select('.x-axis')
        .attr('transform', `translate(0,${drawingHeight})`)
        .transition().duration(scatterPlotAnimationDuration)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('$.2s')));

    scatterPlotG.select('.y-axis')
        .transition().duration(scatterPlotAnimationDuration)
        .call(d3.axisLeft(yScale));

    // Update Labels
    scatterPlotG.select('.x-label')
        .attr('x', drawingWidth / 2)
        .attr('y', drawingHeight + 45)
        .text(currentXCategory);

    scatterPlotG.select('.y-label')
        .attr('x', -drawingHeight / 2)
        .attr('y', -35)
        .text(currentYCategory);

    let tooltip = d3.select('body').select('.scatter-tooltip-external');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('class','scatter-tooltip-external')
            .style('position','absolute').style('background','rgba(255,255,255,0.96)').style('padding','10px 14px')
            .style('border','1px solid #ddd').style('border-radius','6px').style('pointer-events','none')
            .style('opacity',0).style('font-size','12px').style('box-shadow','0 4px 12px rgba(0,0,0,0.15)').style('white-space','nowrap').style('z-index','1050');
    }

    // Draw and animate circles
    const circles = scatterPlotG.selectAll('circle.data-circle')
        .data(filteredData, d => d.Country);

    circles.join(
        enter => enter.append('circle')
            .attr('class', 'data-circle')
            .attr('cx', d => xScale(d[currentXCategory]))
            .attr('cy', d => yScale(d[currentYCategory]))
            .attr('r', 0)
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr('r', d => shouldScaleByPopulation ? radiusScale(d.Population) : scatterPlotFixedRadius)
            ),
        update => update
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr('cx', d => xScale(d[currentXCategory]))
                .attr('cy', d => yScale(d[currentYCategory]))
                .attr('r', d => shouldScaleByPopulation ? radiusScale(d.Population) : scatterPlotFixedRadius)
            ),
        exit => exit
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr('r', 0)
                .remove()
            )
    )
        .attr('fill', d => {
            // Always use continent colors in dashboard
            return continentPalette[regionOf(d.Country)] || '#ccc';
        })
        .attr('opacity', d => {
            if (scatterPlotMasterCountry && d.Country !== scatterPlotMasterCountry) {
                return 0.5; // Fade non-selected countries like in onboarding
            }
            return 0.9; // Default opacity like in onboarding
        })
        .attr('stroke', d => d.Country === scatterPlotMasterCountry ? 'black' : 'none')
        .attr('stroke-width', d => d.Country === scatterPlotMasterCountry ? 2 : 0)
        .on('mouseover', (event, d) => {
            tooltip.style('opacity',0.95);
            const formatComma = d3.format(',');
            tooltip.html(`<strong>${d.Country} ${d.Flag || ''}</strong><br>${currentXCategory}: ${d[currentXCategory]}<br>${currentYCategory}: ${d[currentYCategory]}<br>Population: ${formatComma(d.Population)}`)
                .style('left',`${event.pageX+12}px`).style('top',`${event.pageY-10}px`);
            d3.select(event.currentTarget).raise();
        })
        .on('mouseout', () => tooltip.style('opacity',0));

    // Raise the selected country's circle to be on top (like onboarding)
    if (scatterPlotMasterCountry) {
        circles.filter(d => d.Country === scatterPlotMasterCountry).raise();
    }

    // Remove old legend
    scatterPlotG.select('.scatter-legend').remove();

    // Always show legend with continent colors
    const legend = scatterPlotG.append("g")
        .attr("class", "scatter-legend")
        .attr("transform", `translate(${drawingWidth + 20}, 0)`);

    // Use the same legend data as onboarding (excluding certain entries)
    const legendData = Object.entries(continentPalette)
        .filter(([key]) => !["Africa", "OECD Average", "Other"].includes(key));

    const legendItems = legend.selectAll(".legend-item")
        .data(legendData)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 25})`);

    legendItems.append("rect")
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", d => d[1])
        .attr("opacity", scatterPlotMasterCountry ? 0.5 : 0.9);

    legendItems.append("text")
        .attr("x", 24)
        .attr("y", 14)
        .text(d => d[0])
        .style("font-size", "14px")
        .attr("alignment-baseline", "middle")
        .attr("opacity", scatterPlotMasterCountry ? 0.7 : 1.0);
}

// 4. Radar Chart Functions
function setupRadarChartSVG(selector) {
    const container = d3.select(selector);
    if (container.empty()) { console.error(`Radar chart container ${selector} not found.`); return; }

    container.selectAll('*').remove();
}

function renderRadarChart(selector, data, extents, selectedCountry) {
    const chartContainer = d3.select(selector);
    if (chartContainer.empty()) { console.error(`Radar chart container ${selector} not found.`); return; }
    chartContainer.selectAll('*').remove();

    const W = 350, H = 280;
    const radarMargin = { top: 20, right: 40, bottom: 20, left: 40 };
    const R = Math.min(W - radarMargin.left - radarMargin.right, H - radarMargin.top - radarMargin.bottom) / 2 - 20;
    const angle = 2 * Math.PI / selectedIndicatorsRadar.length;
    const levels = 4;

    const svgRadar = chartContainer.append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .style('width', '100%').style('height', '100%')
        .style('background','#fdfdfd').style('font-family','Raleway, sans-serif')
        .style('border-radius', '8px');
    const gRadar = svgRadar.append('g').attr('transform',`translate(${W/2},${H/2})`);

    for (let i=1; i<=levels; i++) {
        gRadar.append('circle').attr('r', R*i/levels).attr('fill','none').attr('stroke','#e0e0e0').attr('stroke-width', 1);
    }

    selectedIndicatorsRadar.forEach((ind,i) => {
        const a = i*angle - Math.PI/2;
        const x_ax = R * Math.cos(a), y_ax = R * Math.sin(a);
        gRadar.append('line').attr('x1',0).attr('y1',0)
            .attr('x2',x_ax).attr('y2',y_ax).attr('stroke','#ccc').attr('stroke-width', 0.5);
        gRadar.append('text')
            .attr('x',(R+15)*Math.cos(a))
            .attr('y',(R+15)*Math.sin(a))
            .attr('dy', ((a > Math.PI / 2 && a < 3 * Math.PI / 2) || (a < -Math.PI / 2 && a > -3 * Math.PI / 2)) ? '1em' : '0.35em')
            .attr('text-anchor', Math.abs(Math.cos(a)) < 0.01 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'))
            .style('font-size', '9px')
            .style('font-weight', '500')
            .style('fill', '#555')
            .text(formatIndicatorRadar(ind));
    });

    const rScale = d3.scaleLinear([0, 10], [0, R]);

    const oecdAverages = Object.fromEntries(
        selectedIndicatorsRadar.map(ind => {
            const vals = data.filter(d => d.Indicator === ind && typeof d.Value === 'number' && !isNaN(d.Value)).map(d => d.Value);
            return [ind, vals.length > 0 ? d3.mean(vals) : 0];
        })
    );

    const radarPlotData = selectedIndicatorsRadar.flatMap(ind => {
        const extentPair = extents.get(ind);
        if (!extentPair) return [];
        const [lo, hi] = extentPair;
        const normalizeScale = (lo === hi) ? d3.scaleLinear([lo -1, hi + 1],[0,10]) : d3.scaleLinear([lo, hi], [0, 10]);
        const selRow = data.find(d => d.Country === selectedCountry && d.Indicator === ind);
        const selVal = (selRow && typeof selRow.Value === 'number' && !isNaN(selRow.Value)) ? selRow.Value : lo;
        return [
            { country: selectedCountry, indicator: ind, value: normalizeScale(selVal) },
            { country: 'OECD', indicator: ind, value: normalizeScale(oecdAverages[ind]) }
        ];
    });

    const radarLineGen = d3.lineRadial()
        .radius(d => rScale(d.value))
        .angle((d, i) => i * angle)
        .curve(d3.curveLinearClosed);

    const byCountryRadar = d3.group(radarPlotData, d => d.country);
    const colorRadar = d3.scaleOrdinal()
        .domain([selectedCountry, 'OECD'])
        .range([UI_COLORS.primary, UI_COLORS.accent]); // Use primary blue for country, accent blue for OECD

    for (const [countryName, pts] of byCountryRadar) {
        const ordered = selectedIndicatorsRadar.map(ind => pts.find(p => p.indicator === ind));
        if (ordered.some(p => p === undefined)) {
            console.warn(`Radar: Missing data for ${countryName}`);
            continue;
        }
        gRadar.append('path')
            .datum(ordered)
            .attr('d', radarLineGen)
            .attr('fill', colorRadar(countryName))
            .attr('fill-opacity', 0.25)
            .attr('stroke', colorRadar(countryName))
            .attr('stroke-width', 2);
        ordered.forEach((d, i) => {
            if (d === undefined) return;
            const a = i * angle - Math.PI / 2;
            const r_pt = rScale(d.value);
            gRadar.append('circle')
                .attr('cx', r_pt * Math.cos(a))
                .attr('cy', r_pt * Math.sin(a))
                .attr('r', 3)
                .attr('fill', colorRadar(countryName))
                .attr('stroke', 'white')
                .attr('stroke-width', 1);
        });
    }

    const legendRadar = svgRadar.append('g')
        .attr('transform', `translate(${W - 80},${H - 50})`);
    [selectedCountry, 'OECD'].forEach((c, i) => {
        const lg = legendRadar.append('g').attr('transform', `translate(0,${18 * i})`);
        lg.append('line').attr('x1', 0).attr('y1', 8).attr('x2', 20).attr('y2', 8).attr('stroke', colorRadar(c)).attr('stroke-width', 2);
        lg.append('circle').attr('cx', 10).attr('cy', 8).attr('r', 3).attr('fill', colorRadar(c)).attr('stroke', 'white').attr('stroke-width', 1);
        lg.append('text').attr('x', 25).attr('y', 8).attr('dy', '0.35em').style('font-size', '10px').style('font-weight', '500').text(c);
    });
}

// 5. Bar Chart Functions (IMPROVED VERSION)
function setupBarChartSVG(selector) {
    const container = d3.select(selector);
    if (container.empty()) {
        console.error(`Bar chart container ${selector} not found.`);
        return;
    }
    container.selectAll('*').remove();
}

function renderBarChart() {
    const container = d3.select('#bar-chart');
    if (container.empty() || !betterlifeindexDataWide.length) return;

    container.selectAll('*').remove();

    const continentCheckbox = document.getElementById('continent-mode');
    const numSelect = document.getElementById('num-select');
    const propertySelect = document.getElementById('property-select');

    const continentMode = continentCheckbox ? continentCheckbox.checked : false;
    const numVal = numSelect ? numSelect.value : 'Top 10';
    const prop = propertySelect ? propertySelect.value : (numericKeys.length > 0 ? numericKeys[0] : null);

    if (!prop) return;

    const dataForProp = betterlifeindexDataWide.filter(d => typeof d[prop] === 'number' && !isNaN(d[prop]));
    if (dataForProp.length === 0) return;

    const grouped = continentMode
        ? d3.rollup(dataForProp, v => d3.mean(v, d => d[prop]), d => regionOf(d.Country))
        : d3.rollup(dataForProp, v => d3.mean(v, d => d[prop]), d => d.Country);

    let entries = Array.from(grouped.entries())
        .map(([k, v]) => ({ key: k, value: (v === undefined || isNaN(v)) ? 0 : v }))
        .filter(d => d.value !== null && d.value !== undefined);

    entries.sort((a, b) => d3.descending(a.value, b.value));

    if (!continentMode) {
        if (numVal.startsWith('Top ')) {
            const n = +numVal.split(' ')[1];
            entries = entries.slice(0, n);
        }
    }

    if (entries.length === 0) return;

    const W = 350, H = 280;
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const drawingWidth = W - margin.left - margin.right;
    const drawingHeight = H - margin.top - margin.bottom;
    const maxValue = d3.max(entries, d => d.value);

    if (maxValue === undefined) return;

    const svg = container.append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .style('width', '100%').style('height', '100%')
        .style('background', '#fdfdfd').style('border-radius', '8px');

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const vertical = continentMode || ['Top 3', 'Top 5'].includes(numVal);

    // Tooltip for bar chart
    let barTooltip = d3.select('body').select('.bar-tooltip');
    if (barTooltip.empty()) {
        barTooltip = d3.select('body').append('div').attr('class','bar-tooltip')
            .style('position','absolute').style('background','rgba(255,255,255,0.96)').style('padding','8px 12px')
            .style('border','1px solid #ddd').style('border-radius','6px').style('pointer-events','none')
            .style('opacity',0).style('font-size','12px').style('box-shadow','0 4px 12px rgba(0,0,0,0.15)').style('white-space','nowrap').style('z-index','1050');
    }

    if (vertical) {
        const xBand = d3.scaleBand().domain(entries.map(d => d.key)).range([0, drawingWidth]).padding(0.15);
        const yLin = d3.scaleLinear().domain([0, maxValue]).nice().range([drawingHeight, 0]);

        g.append('g').attr('transform', `translate(0,${drawingHeight})`).call(d3.axisBottom(xBand))
            .selectAll("text")
            .style("text-anchor", "end")
            .style("font-size", "9px")
            .style("font-weight", "500")
            .attr("dx", "-.8em").attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
        g.append('g').call(d3.axisLeft(yLin).tickFormat(d3.format('.1s')))
            .selectAll("text")
            .style("font-size", "9px")
            .style("font-weight", "500");

        g.selectAll('rect.bar-rect')
            .data(entries).join('rect').attr('class', 'bar-rect')
            .attr('x', d => xBand(d.key))
            .attr('width', xBand.bandwidth())
            .attr('y', d => yLin(d.value))
            .attr('height', d => drawingHeight - yLin(d.value))
            .attr('fill', d => {
                if (continentMode) {
                    // Use bright continent colors for continent mode
                    return BAR_CHART_COLORS.continent[d.key] || BAR_CHART_COLORS.default;
                } else {
                    // For individual countries, use continent-based bright colors
                    const continent = regionOf(d.key);
                    return BAR_CHART_COLORS.continent[continent] || BAR_CHART_COLORS.default;
                }
            })
            .attr('opacity', d => {
                // Apply opacity based on selection
                if (continentMode) {
                    // Get the continent of the selected country
                    const selectedContinent = scatterPlotMasterCountry ? regionOf(scatterPlotMasterCountry) : null;
                    return d.key === selectedContinent ? 0.9 : 0.5;
                } else {
                    return d.key === scatterPlotMasterCountry ? 0.9 : 0.5; // Country mode with highlighting
                }
            })
            .attr('rx', 2)
            .on('mouseover', (event, d) => {
                barTooltip.style('opacity', 0.95);
                barTooltip.html(`<strong>${d.key}</strong><br/>${prop}: ${d.value.toFixed(2)}`)
                    .style('left', `${event.pageX + 12}px`)
                    .style('top', `${event.pageY - 10}px`);
            })
            .on('mouseout', () => barTooltip.style('opacity', 0));
    } else {
        const xLin = d3.scaleLinear().domain([0, maxValue]).nice().range([0, drawingWidth]);
        const yBand = d3.scaleBand().domain(entries.map(d => d.key)).range([0, drawingHeight]).padding(0.15);

        g.append('g').call(d3.axisLeft(yBand))
            .selectAll("text")
            .style("font-size", "9px")
            .style("font-weight", "500");
        g.append('g').call(d3.axisTop(xLin).tickFormat(d3.format('.1s')))
            .selectAll("text")
            .style("font-size", "9px")
            .style("font-weight", "500");

        g.selectAll('rect.bar-rect')
            .data(entries).join('rect').attr('class', 'bar-rect')
            .attr('y', d => yBand(d.key))
            .attr('height', yBand.bandwidth())
            .attr('x', 0)
            .attr('width', d => xLin(d.value))
            .attr('fill', d => {
                if (continentMode) {
                    // Use bright continent colors for continent mode
                    return BAR_CHART_COLORS.continent[d.key] || BAR_CHART_COLORS.default;
                } else {
                    // For individual countries, use continent-based bright colors
                    const continent = regionOf(d.key);
                    return BAR_CHART_COLORS.continent[continent] || BAR_CHART_COLORS.default;
                }
            })
            .attr('opacity', d => {
                // Apply opacity based on selection
                if (continentMode) {
                    // Get the continent of the selected country
                    const selectedContinent = scatterPlotMasterCountry ? regionOf(scatterPlotMasterCountry) : null;
                    return d.key === selectedContinent ? 0.9 : 0.5;
                } else {
                    return d.key === scatterPlotMasterCountry ? 0.9 : 0.5; // Country mode with highlighting
                }
            })
            .attr('rx', 2)
            .on('mouseover', (event, d) => {
                barTooltip.style('opacity', 0.95);
                barTooltip.html(`<strong>${d.key}</strong><br/>${prop}: ${d.value.toFixed(2)}`)
                    .style('left', `${event.pageX + 12}px`)
                    .style('top', `${event.pageY - 10}px`);
            })
            .on('mouseout', () => barTooltip.style('opacity', 0));
    }
}

// 6. Helper Functions
function regionOf(country) {
    const eu = ["Austria", "Belgium", "Czechia", "Denmark", "Estonia", "Finland",
        "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia",
        "Lithuania", "Luxembourg", "Netherlands", "Norway", "Poland", "Portugal",
        "Slovak Republic", "Slovenia", "Spain", "Sweden", "Switzerland", "Türkiye",
        "United Kingdom", "European Union (27 countries)"];
    const am = ["Canada", "Chile", "Colombia", "Costa Rica", "Mexico", "United States"];
    const as = ["Israel", "Japan", "Korea"];
    const oc = ["Australia", "New Zealand"];
    const af = ["South Africa"];
    if (eu.includes(country)) return "Europe";
    if (am.includes(country)) return "Americas";
    if (as.includes(country)) return "Asia";
    if (oc.includes(country)) return "Oceania";
    if (af.includes(country)) return "Africa";
    if (country && (country.toLowerCase().includes("oecd") || country.toLowerCase().includes("total"))) return "OECD Average";
    return "Other";
}

// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Progress indicator functionality
function initProgressIndicator() {
    const progressDots = document.querySelectorAll('.progress-dot');

    progressDots.forEach((dot, index) => {
        // Add appropriate cursor styles
        if (dot.classList.contains('progress-dot-dashboard')) {
            dot.style.cursor = 'default';
        } else {
            dot.style.cursor = 'pointer';

            // Add click handler for navigation
            dot.addEventListener('click', function() {
                const slideIndex = parseInt(dot.dataset.index);
                if (slideIndex >= 0 && slideIndex <= 5) {
                    // Store the target slide index
                    localStorage.setItem('bli-target-slide', slideIndex.toString());
                    // Navigate to main story
                    window.location.href = 'index.html';
                }
            });
        }
    });
}