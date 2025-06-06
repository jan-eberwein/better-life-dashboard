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
const scatterPlotFullWidth = 750;
const scatterPlotFullHeight = 550;
const scatterPlotMargin = { top: 30, right: 30, bottom: 50, left: 60 };
const scatterPlotFixedRadius = 5;
const scatterPlotHighlightColor = "orange";

let scatterPlotSvg;
let scatterPlotG;
let betterlifeindexDataWide = [];
let scatterPlotMasterCountry = null;
let currentXCategory = 'Job satisfaction';
let currentYCategory = 'Life satisfaction';
let shouldScaleByPopulation = false;

// --- Bar Chart Config & Globals ---
const barChartFullWidth = 900;
const barChartFullHeight = 500;
const barChartMargin = { top: 40, right: 20, bottom: 60, left: 80 };
let barSvg;
let barG;
let numericKeys = [];

// 2. Load CSV and initialize controls
d3.csv('/2024BetterLife.csv', d3.autoType).then(raw => {
    if (!raw || raw.length === 0) {
        console.error("Failed to load or data is empty.");
        return;
    }
    betterlifeindexDataWide = raw;

    const countries = Array.from(new Set(raw.map(d => d.Country))).sort();

    // --- Common Country Selector ---
    const countrySelect = document.getElementById('country-select');
    if (countrySelect) {
        // populate options
        countrySelect.innerHTML = countries.map(c => `<option value="${c}">${c}</option>`).join('');
        // pre-select saved country if exists, otherwise default to first
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
            console.warn(`No valid data for radar indicator: ${ind}`);
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
    } else {
        console.error("Scatter axis select elements not found.");
    }
    if (scalePopCheckbox) {
        scalePopCheckbox.checked = shouldScaleByPopulation;
    } else {
        console.error("Scale population checkbox not found.");
    }

    // --- Bar Chart Controls ---
    const propertySelect = document.getElementById('property-select');
    const numSelect = document.getElementById('num-select');
    const continentCheckbox = document.getElementById('continent-mode');

    if (propertySelect) {
        numericKeys.forEach(k => propertySelect.add(new Option(k, k)));
        if (numericKeys.length > 0) propertySelect.value = numericKeys[0];
    } else {
        console.error("Bar chart property select not found.");
    }

    if (numSelect) {
        ['Top 3', 'Top 5', 'Top 10', 'Top 15', 'All'].forEach(o => numSelect.add(new Option(o, o)));
        numSelect.value = 'Top 10';
    } else {
        console.error("Bar chart num select not found.");
    }

    // Setup SVG containers
    setupScatterPlotSVG('#scatter-plot-container');
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
        localStorage.setItem('bli-selected-country', scatterPlotMasterCountry); // Save selection
        renderScatterPlot();
        if (scatterPlotMasterCountry) renderRadarChart('#chart', radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry);
    };
    if (propertySelect) propertySelect.onchange = () => { renderBarChart(); };
    if (numSelect) numSelect.onchange = () => { renderBarChart(); };
    if (continentCheckbox) continentCheckbox.onchange = () => {
        const numGroup = document.getElementById('num-select-group');
        if (numGroup) numGroup.style.display = continentCheckbox.checked ? 'none' : '';
        renderBarChart();
    };
});

// 3. Scatter Plot Functions
function setupScatterPlotSVG(selector) {
    const container = d3.select(selector);
    if (container.empty()) { console.error(`Scatter plot container ${selector} not found.`); return; }
    scatterPlotSvg = container.append('svg')
        .attr('width', scatterPlotFullWidth)
        .attr('height', scatterPlotFullHeight)
        .attr('viewBox', `0 0 ${scatterPlotFullWidth} ${scatterPlotFullHeight}`)
        .attr('style', 'max-width: 100%; height: auto; background: #f9f9f9; font-family: Raleway, sans-serif; border: 1px solid #ddd;');
    scatterPlotG = scatterPlotSvg.append('g')
        .attr('transform', `translate(${scatterPlotMargin.left},${scatterPlotMargin.top})`);
}

function renderScatterPlot() {
    if (!scatterPlotG || !betterlifeindexDataWide.length) return;
    const drawingWidth = scatterPlotFullWidth - scatterPlotMargin.left - scatterPlotMargin.right;
    const drawingHeight = scatterPlotFullHeight - scatterPlotMargin.top - scatterPlotMargin.bottom;
    const filteredData = betterlifeindexDataWide.filter(d =>
        typeof d[currentXCategory] === 'number' && !isNaN(d[currentXCategory]) &&
        typeof d[currentYCategory] === 'number' && !isNaN(d[currentYCategory]) &&
        d.Population !== undefined && typeof d.Population === 'number' && !isNaN(d.Population)
    );
    if (!filteredData.length) { scatterPlotG.selectAll('*').remove(); return; }
    const xScale = d3.scaleLinear().domain(d3.extent(filteredData, d => d[currentXCategory])).nice().range([0, drawingWidth]);
    const yScale = d3.scaleLinear().domain(d3.extent(filteredData, d => d[currentYCategory])).nice().range([drawingHeight, 0]);
    const radiusScale = shouldScaleByPopulation ? d3.scaleSqrt().domain(d3.extent(filteredData, d => d.Population)).range([3, 25]) : () => scatterPlotFixedRadius;
    scatterPlotG.selectAll('*').remove();
    scatterPlotG.append('g').attr('transform', `translate(0,${drawingHeight})`).call(d3.axisBottom(xScale));
    scatterPlotG.append('g').call(d3.axisLeft(yScale));
    scatterPlotG.append('text').attr('class', 'x-label').attr('text-anchor', 'middle').attr('x', drawingWidth/2).attr('y', drawingHeight + scatterPlotMargin.bottom -10).text(currentXCategory).style('font-size','12px').attr('fill','black');
    scatterPlotG.append('text').attr('class','y-label').attr('text-anchor','middle').attr('transform','rotate(-90)').attr('x', -drawingHeight/2).attr('y', -scatterPlotMargin.left+15).text(currentYCategory).style('font-size','12px').attr('fill','black');
    let tooltip = d3.select('body').select('.scatter-tooltip-external');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div').attr('class','scatter-tooltip-external')
            .style('position','absolute').style('background','rgba(255,255,255,0.95)').style('padding','8px 12px')
            .style('border','1px solid #ccc').style('border-radius','4px').style('pointer-events','none')
            .style('opacity',0).style('font-size','11px').style('box-shadow','0 2px 4px rgba(0,0,0,0.1)').style('white-space','nowrap').style('z-index','1050');
    }
    scatterPlotG.selectAll('circle.data-circle').data(filteredData, d => d.Country)
        .join('circle')
        .attr('class','data-circle')
        .attr('cx', d => xScale(d[currentXCategory]))
        .attr('cy', d => yScale(d[currentYCategory]))
        .attr('r', d => radiusScale(d.Population))
        .attr('fill', d => d.Country === scatterPlotMasterCountry ? scatterPlotHighlightColor : '#007acc')
        .attr('fill-opacity', d => d.Country === scatterPlotMasterCountry ? 1 : 0.6)
        .attr('stroke', d => d.Country === scatterPlotMasterCountry ? 'black' : 'none')
        .on('mouseover', (event, d) => {
            tooltip.style('opacity',0.9);
            const formatComma = d3.format(','); // Added for population formatting
            tooltip.html(`<strong>${d.Country} ${d.Flag || ''}</strong><br>${currentXCategory}: ${d[currentXCategory]}<br>${currentYCategory}: ${d[currentYCategory]}<br>Population: ${formatComma(d.Population)}`)
                .style('left',`${event.pageX+10}px`).style('top',`${event.pageY-20}px`);
            d3.select(event.currentTarget).raise();
        })
        .on('mouseout', () => tooltip.style('opacity',0));
}

// 4. Radar Chart Functions
function renderRadarChart(selector, data, extents, selectedCountry) {
    const chartContainer = d3.select(selector);
    if (chartContainer.empty()) { console.error(`Radar chart container ${selector} not found.`); return; }
    chartContainer.selectAll('*').remove();
    const radarMargin = { top:50, right:100, bottom:50, left:100 };
    const W = 700, H = 600;
    const R = Math.min(W - radarMargin.left - radarMargin.right, H - radarMargin.top - radarMargin.bottom) / 2;
    const angle = 2 * Math.PI / selectedIndicatorsRadar.length;
    const levels = 5;
    const svgRadar = chartContainer.append('svg')
        .attr('width', W).attr('height', H).attr('viewBox',`0 0 ${W} ${H}`)
        .style('background','var(--color-white)').style('font-family','Raleway, sans-serif');
    const gRadar = svgRadar.append('g').attr('transform',`translate(${W/2},${H/2})`);

    for (let i=1; i<=levels; i++) {
        gRadar.append('circle').attr('r', R*i/levels).attr('fill','none').attr('stroke','#ccc');
    }

    selectedIndicatorsRadar.forEach((ind,i) => {
        const a = i*angle - Math.PI/2;
        const x_ax = R * Math.cos(a), y_ax = R * Math.sin(a);
        gRadar.append('line').attr('x1',0).attr('y1',0)
            .attr('x2',x_ax).attr('y2',y_ax).attr('stroke','#999');
        gRadar.append('text')
            .attr('x',(R+25)*Math.cos(a))
            .attr('y',(R+25)*Math.sin(a))
            .attr('dy', ((a > Math.PI / 2 && a < 3 * Math.PI / 2) || (a < -Math.PI / 2 && a > -3 * Math.PI / 2)) ? '1em' : '0.35em')
            .attr('text-anchor', Math.abs(Math.cos(a)) < 0.01 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'))
            .style('font-size', '11px')
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
        .range(['#e41a1c', '#4daf4a']);

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
            .attr('fill-opacity', 0.2)
            .attr('stroke', colorRadar(countryName))
            .attr('stroke-width', 2);
        ordered.forEach((d, i) => {
            if (d === undefined) return;
            const a = i * angle - Math.PI / 2;
            const r_pt = rScale(d.value);
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

// 5. Bar Chart Functions
function setupBarChartSVG(selector) {
    const container = d3.select(selector);
    if (container.empty()) {
        console.error(`Bar chart container ${selector} not found.`);
        return;
    }
    barSvg = container.append('svg')
        .attr('width', barChartFullWidth)
        .attr('height', barChartFullHeight)
        .attr('viewBox', `0 0 ${barChartFullWidth} ${barChartFullHeight}`)
        .style('max-width', '100%').style('height', 'auto');
    barG = barSvg.append('g')
        .attr('transform', `translate(${barChartMargin.left},${barChartMargin.top})`);
}

function renderBarChart() {
    if (!barG || !betterlifeindexDataWide.length) return;

    const continentCheckbox = document.getElementById('continent-mode');
    const numSelect = document.getElementById('num-select');
    const propertySelect = document.getElementById('property-select');

    const continentMode = continentCheckbox ? continentCheckbox.checked : false;
    const numVal = numSelect ? numSelect.value : 'Top 10';
    const prop = propertySelect ? propertySelect.value : (numericKeys.length > 0 ? numericKeys[0] : null);

    if (!prop) { barG.selectAll("*").remove(); return; }

    const dataForProp = betterlifeindexDataWide.filter(d => typeof d[prop] === 'number' && !isNaN(d[prop]));
    if (dataForProp.length === 0) { barG.selectAll("*").remove(); return; }

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

    if (entries.length === 0) { barG.selectAll("*").remove(); return; }

    barG.selectAll('*').remove();

    const drawingWidth = barChartFullWidth - barChartMargin.left - barChartMargin.right;
    const drawingHeight = barChartFullHeight - barChartMargin.top - barChartMargin.bottom;
    const maxValue = d3.max(entries, d => d.value);

    if (maxValue === undefined) return;

    const vertical = continentMode || ['Top 3', 'Top 5'].includes(numVal);

    if (vertical) {
        const xBand = d3.scaleBand().domain(entries.map(d => d.key)).range([0, drawingWidth]).padding(0.1);
        const yLin = d3.scaleLinear().domain([0, maxValue]).nice().range([drawingHeight, 0]);
        barG.append('g').attr('transform', `translate(0,${drawingHeight})`).call(d3.axisBottom(xBand))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em").attr("dy", ".15em")
            .attr("transform", "rotate(-45)");
        barG.append('g').call(d3.axisLeft(yLin));
        barG.selectAll('rect.bar-rect')
            .data(entries).join('rect').attr('class', 'bar-rect')
            .attr('x', d => xBand(d.key))
            .attr('width', xBand.bandwidth())
            .attr('y', d => yLin(d.value))
            .attr('height', d => drawingHeight - yLin(d.value))
            .attr('fill', '#69b3a2');
    } else {
        const xLin = d3.scaleLinear().domain([0, maxValue]).nice().range([0, drawingWidth]);
        const yBand = d3.scaleBand().domain(entries.map(d => d.key)).range([0, drawingHeight]).padding(0.1);
        barG.append('g').call(d3.axisLeft(yBand));
        barG.append('g').call(d3.axisTop(xLin).ticks(drawingWidth / 80));
        barG.selectAll('rect.bar-rect')
            .data(entries).join('rect').attr('class', 'bar-rect')
            .attr('y', d => yBand(d.key))
            .attr('height', yBand.bandwidth())
            .attr('x', 0)
            .attr('width', d => xLin(d.value))
            .attr('fill', '#404080');
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
