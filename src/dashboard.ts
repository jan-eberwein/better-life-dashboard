// Complete merged and updated file combining file one and file two
// File: dashboard.ts

import * as d3 from 'd3';

// ── Configuration ───────────────────────────────────────────
const selectedIndicatorsRadar = [
    'Housing expenditure', 'Rooms per person', 'Household net adjusted disposable income',
    'Household net wealth', 'Employment rate', 'Personal earnings',
    'Quality of support network', 'Educational attainment', 'Student skills',
    'Life expectancy', 'Self-reported health'
];
const formatIndicatorRadar = (ind: string) => ({
    'Housing expenditure': 'Housing', 'Rooms per person': 'Living space',
    'Household net adjusted disposable income': 'Income', 'Household net wealth': 'Wealth',
    'Employment rate': 'Employment', 'Personal earnings': 'Earnings',
    'Quality of support network': 'Social support', 'Educational attainment': 'Education',
    'Student skills': 'Skills', 'Life expectancy': 'Health', 'Self-reported health': 'Well-being'
}[ind] || ind);

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

const barMargin = { top: 40, right: 20, bottom: 60, left: 80 };
const barFullWidth = 900;
const barFullHeight = 500;
let barSvg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let barG: d3.Selection<SVGGElement, unknown, null, undefined>;

Promise.all([d3.csv('/2024BetterLife.csv', d3.autoType)]).then(([raw]) => {
    betterlifeindexDataWide = raw;
    const rawKeys = Object.keys(raw[0]).filter(k => k !== 'Country');
    const radarChartLongData = raw.flatMap(row =>
        rawKeys.map(key => ({
            Country: row.Country as string,
            Indicator: key.trim(),
            Value: +(row as any)[key]
        }))
    );
    const extentByIndicatorRadar = new Map<string, [number, number]>();
    for (const ind of selectedIndicatorsRadar) {
        const vals = radarChartLongData.filter(d => d.Indicator === ind).map(d => d.Value);
        extentByIndicatorRadar.set(ind, [d3.min(vals)!, d3.max(vals)!]);
    }

    const countrySelect = d3.select<HTMLSelectElement>('#country-select');
    const countries = Array.from(new Set(raw.map(d => d.Country))).sort();
    countrySelect.selectAll('option')
        .data(countries).join('option')
        .attr('value', d => d).text(d => d);
    scatterPlotMasterCountry = countries[0];

    const numericKeys = Object.keys(raw[0]).filter(k =>
        k !== 'Country' && k !== 'Population' && k !== 'Flag' && typeof (raw[0] as any)[k] === 'number'
    );

    const xAxisSelect = d3.select<HTMLSelectElement>('#x-axis-select');
    const yAxisSelect = d3.select<HTMLSelectElement>('#y-axis-select');
    const scalePopCheckbox = d3.select<HTMLInputElement>('#scale-population-checkbox');
    numericKeys.forEach(k => {
        xAxisSelect.append('option').attr('value', k).text(k);
        yAxisSelect.append('option').attr('value', k).text(k);
    });
    xAxisSelect.property('value', currentXCategory);
    yAxisSelect.property('value', currentYCategory);
    scalePopCheckbox.property('checked', shouldScaleByPopulation);

    const propertySelect = d3.select<HTMLSelectElement>('#property-select');
    const numSelect = d3.select<HTMLSelectElement>('#num-select');
    const numGroup = d3.select<HTMLDivElement>('#num-select-group');
    const continentCheckbox = d3.select<HTMLInputElement>('#continent-mode');
    numericKeys.forEach(k => propertySelect.append('option').attr('value', k).text(k));
    propertySelect.property('value', numericKeys[0]);

    function setNumOptions() {
        numSelect.selectAll('option').remove();
        ['Top 3', 'Top 5', 'Top 10', 'Top 15', 'All'].forEach(o =>
            numSelect.append('option').attr('value', o).text(o)
        );
    }
    setNumOptions();

    setupScatterPlotSVG('#scatter-plot-container');
    setupBarChartSVG('#bar-chart');

    countrySelect.on('change', () => {
        scatterPlotMasterCountry = (d3.event.target as HTMLSelectElement).value;
        renderScatterPlot();
        renderRadarChart(radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry!);
    });
    xAxisSelect.on('change', () => { currentXCategory = xAxisSelect.property('value'); renderScatterPlot(); });
    yAxisSelect.on('change', () => { currentYCategory = yAxisSelect.property('value'); renderScatterPlot(); });
    scalePopCheckbox.on('change', () => { shouldScaleByPopulation = scalePopCheckbox.property('checked'); renderScatterPlot(); });
    continentCheckbox.on('change', () => {
        const on = continentCheckbox.property('checked');
        numGroup.style('display', on ? 'none' : null);
        renderBarChart();
    });
    numSelect.on('change', renderBarChart);
    propertySelect.on('change', renderBarChart);

    renderScatterPlot();
    renderRadarChart(radarChartLongData, extentByIndicatorRadar, scatterPlotMasterCountry!);
    renderBarChart();
});

function setupScatterPlotSVG(selector: string) {
    scatterPlotSvg = d3.select(selector).append('svg')
        .attr('width', scatterPlotFullWidth)
        .attr('height', scatterPlotFullHeight)
        .style('max-width', '100%')
        .style('height', 'auto');
    scatterPlotG = scatterPlotSvg.append('g')
        .attr('transform', `translate(${scatterPlotMargin.left},${scatterPlotMargin.top})`);
}

function setupBarChartSVG(selector: string) {
    barSvg = d3.select(selector).append('svg')
        .attr('width', barFullWidth)
        .attr('height', barFullHeight)
        .style('max-width', '100%')
        .style('height', 'auto');
    barG = barSvg.append('g')
        .attr('transform', `translate(${barMargin.left},${barMargin.top})`);
}

function regionOf(country: string): string {
    const eu = ["Austria", "Belgium", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Netherlands", "Norway", "Poland", "Portugal", "Slovak Republic", "Slovenia", "Spain", "Sweden", "Switzerland", "Türkiye", "United Kingdom"];
    const am = ["Canada", "Chile", "Colombia", "Costa Rica", "Mexico", "United States"];
    const as = ["Israel", "Japan", "Korea"];
    const oc = ["Australia", "New Zealand"];
    if (eu.includes(country)) return "Europe";
    if (am.includes(country)) return "Americas";
    if (as.includes(country)) return "Asia";
    if (oc.includes(country)) return "Oceania";
    return "Other";
}

// RENDER FUNCTIONS

function renderScatterPlot() {
    if (!scatterPlotG || !betterlifeindexDataWide.length) return;

    const drawingWidth = scatterPlotFullWidth - scatterPlotMargin.left - scatterPlotMargin.right;
    const drawingHeight = scatterPlotFullHeight - scatterPlotMargin.top - scatterPlotMargin.bottom;

    const filteredData = betterlifeindexDataWide.filter(d => {
        const xVal = d[currentXCategory];
        const yVal = d[currentYCategory];
        const popVal = d.Population;
        return typeof xVal === 'number' && !isNaN(xVal)
            && typeof yVal === 'number' && !isNaN(yVal)
            && typeof popVal === 'number' && !isNaN(popVal);
    });

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
    let xAxisGroup = scatterPlotG.select<SVGGElement>('g.x-axis');
    if (xAxisGroup.empty()) {
        xAxisGroup = scatterPlotG.append('g').attr('class', 'x-axis');
    }
    xAxisGroup
        .attr('transform', `translate(0,${drawingHeight})`)
        .transition().duration(scatterPlotAnimationDuration)
        .call(d3.axisBottom(xScale));

    let yAxisGroup = scatterPlotG.select<SVGGElement>('g.y-axis');
    if (yAxisGroup.empty()) {
        yAxisGroup = scatterPlotG.append('g').attr('class', 'y-axis');
    }
    yAxisGroup
        .transition().duration(scatterPlotAnimationDuration)
        .call(d3.axisLeft(yScale));

    // Labels
    let xLabel = scatterPlotG.select<SVGTextElement>('text.x-label');
    if (xLabel.empty()) {
        xLabel = scatterPlotG.append('text').attr('class', 'x-label')
            .attr('text-anchor', 'middle').attr('fill', 'black').style('font-size', '12px');
    }
    xLabel.attr('x', drawingWidth / 2).attr('y', drawingHeight + scatterPlotMargin.bottom - 10)
        .text(currentXCategory);

    let yLabel = scatterPlotG.select<SVGTextElement>('text.y-label');
    if (yLabel.empty()) {
        yLabel = scatterPlotG.append('text').attr('class', 'y-label')
            .attr('text-anchor', 'middle').attr('fill', 'black').style('font-size', '12px')
            .attr('transform', 'rotate(-90)');
    }
    yLabel.attr('x', -drawingHeight / 2).attr('y', -scatterPlotMargin.left + 15)
        .text(currentYCategory);

    // Tooltip
    let tooltip = d3.select('body').select<HTMLDivElement>('.scatter-tooltip-external');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('class', 'scatter-tooltip-external')
            .style('position', 'absolute')
            .style('background', 'rgba(255,255,255,0.95)')
            .style('padding', '8px 12px')
            .style('border', '1px solid #ccc')
            .style('border-radius', '4px')
            .style('pointer-events', 'none')
            .style('opacity', 0)
            .style('font-size', '11px')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
            .style('white-space', 'nowrap')
            .style('z-index', '1050');
    }

    const circles = scatterPlotG.selectAll<SVGCircleElement, any>('circle.data-circle')
        .data(filteredData, (d: any) => d.Country);

    circles.join(
        enter => enter.append('circle')
            .attr('class', 'data-circle')
            .attr('fill', d => d.Country === scatterPlotMasterCountry ? scatterPlotHighlightColor : '#007acc')
            .attr('fill-opacity', d => d.Country === scatterPlotMasterCountry ? 1 : 0.6)
            .attr('stroke', d => d.Country === scatterPlotMasterCountry ? 'black' : 'none')
            .attr('cx', d => xScale(d[currentXCategory]))
            .attr('cy', d => yScale(d[currentYCategory]))
            .attr('r', 0)
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr('r', d => shouldScaleByPopulation ? radiusScale(d.Population) : scatterPlotFixedRadius)
            ),
        update => update
            .attr('fill', d => d.Country === scatterPlotMasterCountry ? scatterPlotHighlightColor : '#007acc')
            .attr('fill-opacity', d => d.Country === scatterPlotMasterCountry ? 1 : 0.6)
            .attr('stroke', d => d.Country === scatterPlotMasterCountry ? 'black' : 'none')
            .call(s => s.transition().duration(scatterPlotAnimationDuration)
                .attr('cx', d => xScale(d[currentXCategory]))
                .attr('cy', d => yScale(d[currentYCategory]))
                .attr('r', d => shouldScaleByPopulation ? radiusScale(d.Population) : scatterPlotFixedRadius)
            ),
        exit => exit.call(s => s.transition().duration(scatterPlotAnimationDuration).attr('r', 0).remove())
    )
        .on('mouseover', (event, d: any) => {
            tooltip.transition().duration(100).style('opacity', 0.9);
            const formatComma = d3.format(',');
            tooltip.html(`<strong>${d.Country}</strong><br>
        ${currentXCategory}: ${d[currentXCategory]}<br>
        ${currentYCategory}: ${d[currentYCategory]}<br>
        Population: ${formatComma(d.Population)}`)
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY - 20}px`);
            d3.select(event.currentTarget).raise();
        })
        .on('mouseout', () => tooltip.transition().duration(200).style('opacity', 0));
}

function renderRadarChart(
    data: { Country: string; Indicator: string; Value: number }[],
    extents: Map<string, [number, number]>,
    selectedCountry: string
) {
    d3.select('#chart').selectAll('*').remove();

    const oecdAverages = Object.fromEntries(
        selectedIndicatorsRadar.map(ind => {
            const vals = data.filter(d => d.Indicator === ind).map(d => d.Value);
            return [ind, d3.mean(vals)!];
        })
    );

    const radarData = selectedIndicatorsRadar.flatMap((ind, i) => {
        const [lo, hi] = extents.get(ind)!;
        const scale = d3.scaleLinear([lo, hi], [0, 10]);
        const selVal = data.find(d => d.Country === selectedCountry && d.Indicator === ind)?.Value ?? lo;
        return [
            { country: selectedCountry, indicator: ind, value: scale(selVal) },
            { country: 'OECD', indicator: ind, value: scale(oecdAverages[ind]) }
        ];
    });

    const margin = { top: 50, right: 100, bottom: 50, left: 100 };
    const W = 700, H = 600;
    const R = Math.min(W - margin.left - margin.right, H - margin.top - margin.bottom) / 2;
    const angle = (2 * Math.PI) / selectedIndicatorsRadar.length;
    const levels = 5;

    const svg = d3.select('#chart').append('svg')
        .attr('width', W)
        .attr('height', H)
        .attr('viewBox', `0 0 ${W} ${H}`)
        .style('background', 'var(--color-white)')
        .style('font-family', 'Raleway, sans-serif');

    const g = svg.append('g')
        .attr('transform', `translate(${W/2},${H/2})`);

    // Grid
    for (let lvl = 1; lvl <= levels; lvl++) {
        g.append('circle')
            .attr('r', (R * lvl) / levels)
            .attr('fill', 'none')
            .attr('stroke', '#ccc');
    }

    // Axes
    selectedIndicatorsRadar.forEach((ind, i) => {
        const a = i * angle - Math.PI/2;
        const x2 = R * Math.cos(a), y2 = R * Math.sin(a);
        g.append('line')
            .attr('x1', 0).attr('y1', 0)
            .attr('x2', x2).attr('y2', y2)
            .attr('stroke', '#999');
        g.append('text')
            .attr('x', (R+20) * Math.cos(a))
            .attr('y', (R+20) * Math.sin(a))
            .attr('dy', ((a > Math.PI/2 && a < 3*Math.PI/2) || (a < -Math.PI/2 && a > -3*Math.PI/2)) ? '1em' : '0.35em')
            .attr('text-anchor', Math.abs(Math.cos(a))<0.01 ? 'middle' : (Math.cos(a)>0?'start':'end'))
            .style('font-size','12px')
            .text(formatIndicatorRadar(ind));
    });

    const rScale = d3.scaleLinear([0,10], [0,R]);
    const lineGen = d3.lineRadial<any>()
        .radius(d => rScale(d.value))
        .angle((_, i) => i * angle)
        .curve(d3.curveLinearClosed);

    const byCountry = d3.group(radarData, d => d.country);
    const color = d3.scaleOrdinal<string>()
        .domain([selectedCountry,'OECD'])
        .range(['#e41a1c','#4daf4a']);

    for (const [country, pts] of byCountry) {
        const ptsOrdered = selectedIndicatorsRadar.map(ind => pts.find(p => p.indicator===ind)!);
        g.append('path')
            .datum(ptsOrdered)
            .attr('d', lineGen as any)
            .attr('fill', color(country))
            .attr('fill-opacity',0.2)
            .attr('stroke', color(country))
            .attr('stroke-width',2);
        ptsOrdered.forEach((d,i)=>{
            const a = i*angle - Math.PI/2;
            const r = rScale(d.value);
            g.append('circle')
                .attr('cx', r*Math.cos(a))
                .attr('cy', r*Math.sin(a))
                .attr('r',4)
                .attr('fill', color(country));
        });
    }

    // Legend
    const leg = svg.append('g')
        .attr('transform', `translate(${W - margin.right + 20},${margin.top})`);
    [selectedCountry,'OECD'].forEach((c,i)=>{
        const lg = leg.append('g').attr('transform', `translate(0,${25*i})`);
        lg.append('line').attr('x1',0).attr('y1',10).attr('x2',30).attr('y2',10)
            .attr('stroke', color(c)).attr('stroke-width',2);
        lg.append('circle').attr('cx',15).attr('cy',10).attr('r',4).attr('fill',color(c));
        lg.append('text').attr('x',40).attr('y',10).attr('dy','0.35em').style('font-size','12px').text(c);
    });
}

function renderBarChart() {
    if (!barG || !betterlifeindexDataWide.length) return;

    const continentMode = d3.select<HTMLInputElement>('#continent-mode').property('checked');
    const numVal = d3.select<HTMLSelectElement>('#num-select').property('value');
    const prop = d3.select<HTMLSelectElement>('#property-select').property('value');

    const grouped = continentMode
        ? d3.rollup(betterlifeindexDataWide, v => d3.mean(v, d => d[prop]), d => regionOf(d.Country))
        : d3.rollup(betterlifeindexDataWide, v => d3.mean(v, d => d[prop]), d => d.Country);

    let entries = Array.from(grouped.entries()).map(([k,v]) => ({ key:k, value:v! }));
    entries.sort((a,b) => d3.descending(a.value,b.value));

    if (!continentMode && numVal.startsWith('Top ')) {
        const n = +numVal.split(' ')[1];
        entries = entries.slice(0,n);
    }

    barG.selectAll('*').remove();

    const width = barFullWidth - barMargin.left - barMargin.right;
    const height = barFullHeight - barMargin.top - barMargin.bottom;

    const x = d3.scaleLinear()
        .domain([0, d3.max(entries, d => d.value)!]).nice()
        .range([0, width]);
    const y = d3.scaleBand()
        .domain(entries.map(d => d.key))
        .range([0, height])
        .padding(0.1);

    const vertical = continentMode || ['Top 3','Top 5'].includes(numVal);

    if (vertical) {
        const xBand = d3.scaleBand()
            .domain(entries.map(d => d.key))
            .range([0, width])
            .padding(0.1);
        const yLin = d3.scaleLinear()
            .domain([0, d3.max(entries, d => d.value)!]).nice()
            .range([height, 0]);

        barG.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xBand));
        barG.append('g')
            .call(d3.axisLeft(yLin));

        barG.selectAll('rect')
            .data(entries)
            .join('rect')
            .attr('x', d => xBand(d.key)!)
            .attr('width', xBand.bandwidth())
            .attr('y', d => yLin(d.value))
            .attr('height', d => height - yLin(d.value))
            .attr('fill', '#69b3a2');

    } else {
        barG.append('g')
            .call(d3.axisLeft(y));
        barG.append('g')
            .call(d3.axisTop(x).ticks(5));

        barG.selectAll('rect')
            .data(entries)
            .join('rect')
            .attr('y', d => y(d.key)!)
            .attr('height', y.bandwidth())
            .attr('x', 0)
            .attr('width', d => x(d.value))
            .attr('fill', '#404080');
    }
}