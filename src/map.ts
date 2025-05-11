// src/map.ts
import { csv, json } from 'd3-fetch';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface DrawMapOptions {
  containerId: string;
  csvUrl?: string;
  geojsonUrl?: string;
}

// Ensure the GeoJSON feature properties include a 'name' field
interface CountryProperties {
  name: string;
}

interface DataRecord {
  country: string;
  flag: string;
  value: number; // Life satisfaction
  gdp: number;
  leisure: number;
  rooms: number;
  population: number;
}

export async function drawMap(
    containerId: string,
    options?: DrawMapOptions
): Promise<void> {
  const opts = {
    containerId,
    csvUrl: options?.csvUrl ?? '/data/2024BetterLife.csv',
    geojsonUrl: options?.geojsonUrl ?? '/data/world.geojson'
  };

  // Container & dimensions
  const container = document.getElementById(opts.containerId);
  if (!container) {
    console.error(`Container '#${opts.containerId}' not found`);
    return;
  }
  // Clear any previous content
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight > 50 ? container.clientHeight : 500;

// Load CSV and GeoJSON with correct typings
  const [rawCsv, worldGeo] = await Promise.all([
    csv<Record<string, string>>(opts.csvUrl),
    json<FeatureCollection<Geometry, CountryProperties>>(opts.geojsonUrl)
  ]);

  if (!rawCsv || !worldGeo) {
    console.error(`Failed to load data from ${opts.csvUrl} or ${opts.geojsonUrl}`);
    return;
  }

  // Parse records, guarding against missing fields
  const data: DataRecord[] = rawCsv.map(row => {
    const get = (key: string, def = '0') => (row && row[key]?.trim()) || def; // Ensure row is not undefined
    return {
      country:    get('Country', 'Unknown'),
      flag:       get('Flag', '🏳️'),
      value:      Number(get('Life satisfaction')),
      gdp:        Number(get('GDP per capita (USD)')),
      leisure:    Number(get('Time devoted to leisure and personal care')),
      rooms:      Number(get('Rooms per person')),
      population: Number(get('Population'))
    };
  });

  // Compute OECD averages (exclude NaNs)
  const oecdAvg = {
    value:   d3.mean(data, d => isNaN(d.value) ? undefined : d.value) ?? 0,
    gdp:     d3.mean(data, d => isNaN(d.gdp)   ? undefined : d.gdp)   ?? 0,
    leisure: d3.mean(data, d => isNaN(d.leisure)? undefined : d.leisure)?? 0,
    rooms:   d3.mean(data, d => isNaN(d.rooms)  ? undefined : d.rooms)  ?? 0
  };

  // Controls (region dropdown)
  const controlsDiv = d3.select(container)
      .append('div')
      .attr('id', 'controls')
      .style('margin-bottom', '10px'); // Added for consistent spacing

  controlsDiv.append('label')
      .attr('for', 'region-select')
      .text('Region: ')
      .style('margin-right', '5px');

  const select = controlsDiv.append('select')
      .attr('id', 'region-select')
      .on('change', function(this: HTMLSelectElement, event: Event) {
        // `this` is now correctly typed
        zoomTo(this.value);
      });


  ['World','Europe','Africa','Asia','Americas','Oceania']
      .forEach(region => select.append('option').attr('value', region).text(region));

  // Country detail widget (initial prompt)
  const widget = d3.select(container)
      .append('div')
      .attr('id', 'country-widget')
      .html('<em>Click a country to see details</em>');

  // SVG map
  const controlsHeight = (controlsDiv.node() as HTMLElement)?.clientHeight || 0;
  const widgetHeight = (widget.node() as HTMLElement)?.clientHeight || 0;
  const svgHeight = height - controlsHeight - widgetHeight - 20; // 20 for padding/margins

  const svg = d3.select(container)
      .append('svg')
      .attr('id', 'map-svg')
      .attr('width', width)
      .attr('height', svgHeight > 50 ? svgHeight : 300) // Ensure a minimum height
      .attr('viewBox', `0 0 ${width} ${svgHeight > 50 ? svgHeight : 300}`);

  const projection = d3.geoNaturalEarth1()
      .fitSize([width, svgHeight > 50 ? svgHeight : 300], worldGeo as any); // fitSize to the calculated SVG area
  const pathGen = d3.geoPath(projection as any);

  // Tooltip
  const tooltip = d3.select(container) // Append to map container for positioning
      .append('div')
      .attr('id', 'tooltip') // Ensure CSS styles for #tooltip are applied
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0);

  // Color scale based on life satisfaction
  const values = data.map(d => d.value).filter(v => !isNaN(v));
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain(d3.extent(values) as [number, number]);

  // Draw countries
  const g = svg.append('g');
  g.selectAll('path.country')
      .data(worldGeo.features)
      .join('path')
      .attr('class', 'country')
      .attr('d', pathGen as any)
      .attr('fill', (d: Feature<Geometry, CountryProperties>) => {
        const rec = data.find(p => p.country === d.properties.name);
        return rec && !isNaN(rec.value) ? colorScale(rec.value) : '#eee';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mouseover', function(event: MouseEvent, d: Feature<Geometry, CountryProperties>) { // Use function for `this`
        d3.select(this).attr('stroke-width', 1.5).attr('stroke', '#333');
        showTooltip(event, d);
      })
      .on('mousemove', moveTooltip) // Keep separate for clarity
      .on('mouseout', function() { // Use function for `this`
        d3.select(this).attr('stroke-width', 0.5).attr('stroke', '#fff');
        tooltip.style('opacity', 0);
      })
      .on('click', (_event: MouseEvent, d: Feature<Geometry, CountryProperties>) => {
        const rec = data.find(p => p.country === d.properties.name);
        if (rec) {
          updateWidget(rec);
          localStorage.setItem('bli-selected-country', rec.country);
        }
      });

  // Zoom behavior
  const zoom = d3.zoom<SVGSVGElement,unknown>()
      .scaleExtent([1, 8])
      .on('zoom', ({ transform }) => { // Destructure event to get transform directly
        g.attr('transform', transform.toString());
      });
  svg.call(zoom as any); // D3 types can be tricky with zoom

  // Zoom to region helper
  function zoomTo(region: string) {
    const boxes: Record<string, [[number,number],[number,number]]> = {
      World:   [[-180,-90],[180,90]],
      Europe:  [[-25,34],[40,71]],
      Africa:  [[-20,-35],[55,38]],
      Asia:    [[25,-10],[180,80]],
      Americas:[[-170,-60],[-30,85]],
      Oceania: [[110,-50],[180,10]]
    };
    const [[x0,y0],[x1,y1]] = boxes[region] || boxes.World; // Fallback to World
    const p0 = projection([x0, y1])!;
    const p1 = projection([x1, y0])!;
    const boundsW = Math.abs(p1[0] - p0[0]);
    const boundsH = Math.abs(p1[1] - p0[1]);

    const currentSvgHeight = parseFloat(svg.attr('height')); // Get current SVG height for scaling

    const scale = 0.9 * Math.min(width / boundsW, currentSvgHeight / boundsH);
    const translate: [number, number] = [
      width/2 - scale*(p0[0]+p1[0])/2,
      currentSvgHeight/2 - scale*(p0[1]+p1[1])/2
    ];
    svg.transition().duration(750)
        .call((zoom as any).transform, // Type assertion
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
  }

  // Tooltip display with mini-radar (restored from old file)
  function showTooltip(event: MouseEvent, d: Feature<Geometry, CountryProperties>) {
    const rec = data.find(p => p.country === d.properties.name);
    if (!rec) return;

    tooltip.html('') // Clear previous
        .style('opacity', 0.9); // Make visible

    const header = tooltip.append('div').attr('class','tooltip-header');
    header.append('span').attr('class','flag').text(rec.flag);
    header.append('span').attr('class','name').text(rec.country);
    header.append('span').attr('class','pop').text(`${(rec.population/1e6).toFixed(2)}M`);

    tooltip.append('div').attr('class','tooltip-metric')
        .html(`Life satisfaction: <span class="ls-value" style="color:${colorScale(rec.value)}">${rec.value.toFixed(1)}</span>`);

    // --- Mini-Radar Chart Logic (from old file, adapted) ---
    const rcContainer = tooltip.append('div').attr('class','tooltip-chart');
    const indicators: (keyof DataRecord)[] = ['value','gdp','leisure','rooms'];
    const angleStep = 2 * Math.PI / indicators.length;
    const W = 120, H = 120, radarMargin = 15; // Dimensions for mini-radar
    const R = Math.min(W, H) / 2 - radarMargin;

    const extents = new Map<keyof DataRecord, [number, number]>(
        indicators.map(ind => {
          const values = data.map(item => item[ind] as number).filter(v => !isNaN(v));
          return [ind, d3.extent(values) as [number, number]];
        })
    );

    type Point = { angle: number; ratio: number };
    const radarPlotData: { country: string; points: Point[] }[] = [
      { country: rec.country, points: [] },
      { country: 'OECD', points: [] }
    ];

    indicators.forEach((ind, i) => {
      const extentPair = extents.get(ind);
      if (!extentPair) return; // Should not happen if extents are built correctly
      const [lo, hi] = extentPair;
      const scaleNorm = (lo === hi)
          ? d3.scaleLinear([lo - 1, (hi || 0) + 1], [0, 1]) // Ensure hi+1 is not problematic if hi is 0
          : d3.scaleLinear([lo, hi], [0, 1]);
      const valRec = rec[ind] as number;
      const avg = oecdAvg[ind as keyof typeof oecdAvg]; // Access oecdAvg correctly
      radarPlotData[0].points.push({ angle: i * angleStep, ratio: scaleNorm(valRec) });
      radarPlotData[1].points.push({ angle: i * angleStep, ratio: scaleNorm(avg) });
    });

    const svgR = rcContainer.append('svg')
        .attr('width', W)
        .attr('height', H)
        .append('g')
        .attr('transform', `translate(${W/2},${H/2})`);

    const levels = 3;
    for (let lvl = 1; lvl <= levels; lvl++) {
      svgR.append('circle')
          .attr('r', R * lvl / levels)
          .attr('fill', 'none')
          .attr('stroke', '#ccc');
    }

    indicators.forEach((ind, i) => {
      const ang = i * angleStep - Math.PI/2; // Align first axis upwards
      svgR.append('line') // Axis lines
          .attr('x1', 0).attr('y1', 0)
          .attr('x2', R * Math.cos(ang)).attr('y2', R * Math.sin(ang))
          .attr('stroke', '#bbb').attr('stroke-dasharray', '2,2');
      svgR.append('text') // Axis labels
          .attr('x', (R + 8) * Math.cos(ang))
          .attr('y', (R + 8) * Math.sin(ang))
          .attr('dy', '0.35em')
          .attr('text-anchor', Math.abs(Math.cos(ang)) < 0.1 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end'))
          .style('font-size', '8px')
          .text(ind === 'value' ? 'LifeSat' : (ind.charAt(0).toUpperCase() + ind.slice(1,4)));
    });

    const rScaleRadar = d3.scaleLinear([0, 1], [0, R]); // Scale for radar radius based on 0-1 ratio
    const lineGenRadar = d3.lineRadial<Point>()
        .angle(d => d.angle - Math.PI/2) // Align with axes
        .radius(d => rScaleRadar(d.ratio))
        .curve(d3.curveLinearClosed);

    const colorRadar = d3.scaleOrdinal<string>()
        .domain(radarPlotData.map(d => d.country)) // Country names for domain
        .range(['#e41a1c', '#4daf4a']); // Colors for selected country and OECD

    radarPlotData.forEach(series => {
      svgR.append('path')
          .datum(series.points)
          .attr('d', lineGenRadar as any)
          .attr('fill', colorRadar(series.country))
          .attr('fill-opacity', 0.3)
          .attr('stroke', colorRadar(series.country))
          .attr('stroke-width', 1.5);
    });

    // Legend for mini-radar
    const legendContainer = tooltip.append('div').attr('class', 'tooltip-legend');
    const legendList = legendContainer.append('ul'); // UL should be styled in CSS for list-style:none
    radarPlotData.forEach(series => {
      const li = legendList.append('li'); // Append li to ul
      li.append('span').attr('class', 'legend-color').style('background-color', colorRadar(series.country));
      li.append('span').attr('class', 'legend-label').text(series.country === 'OECD' ? 'OECD Avg.' : series.country);
    });
    // --- End of Mini-Radar ---

    moveTooltip(event); // Position after all content is set
  }

  // Tooltip positioning
  function moveTooltip(event: MouseEvent) {
    const node = tooltip.node() as HTMLElement;
    if (!node) return; // Ensure node exists
    let x = event.pageX + 15;
    let y = event.pageY + 15;
    // Boundary collision detection
    if (x + node.offsetWidth > window.innerWidth) x = event.pageX - node.offsetWidth - 15;
    if (y + node.offsetHeight > window.innerHeight) y = event.pageY - node.offsetHeight - 15;
    if (y < 0) y = 15; // Prevent going off screen top

    tooltip.style('left', `${x}px`).style('top', `${y}px`);
  }

  // Update country detail widget
  function updateWidget(rec: DataRecord) {
    widget.html(''); // Clear previous content
    const header = widget.append('div').attr('class', 'widget-header');
    header.append('span').attr('class', 'flag').text(rec.flag);
    header.append('span').attr('class', 'country-name').text(rec.country);
    header.append('span').attr('class', 'pop').text(`Pop: ${(rec.population/1e6).toFixed(2)}M`);

    const list = widget.append('ul').attr('class', 'widget-metrics');
    list.append('li')
        .html(`Life satisfaction: <span class="ls-value" style="color:${colorScale(rec.value)}">${rec.value.toFixed(1)}</span> (Avg: ${oecdAvg.value.toFixed(1)})`);
    list.append('li')
        .text(`GDP per capita: $${rec.gdp.toLocaleString()} (Avg: $${oecdAvg.gdp.toLocaleString()})`);
    list.append('li')
        .text(`Leisure (hrs/day): ${rec.leisure.toFixed(1)} (Avg: ${oecdAvg.leisure.toFixed(1)})`);
    list.append('li')
        .text(`Rooms per person: ${rec.rooms.toFixed(1)} (Avg: ${oecdAvg.rooms.toFixed(1)})`);
  }

  // Initial zoom to World or saved country
  const savedCountryName = localStorage.getItem('bli-selected-country');
  const initialCountryRec = savedCountryName ? data.find(p => p.country === savedCountryName) : null;

  if (initialCountryRec) {
    updateWidget(initialCountryRec);
    // Optionally, try to find the GeoJSON feature and zoom to it, or select in dropdown
    const countryFeature = worldGeo.features.find(f => f.properties.name === savedCountryName);
    if (countryFeature) {
      // Implement zoomToFeature or highlight logic if desired
    }
    if (select.node()) { // Ensure select exists
      (select.node() as HTMLSelectElement).value = 'World'; // Default zoom to World even if country is pre-filled in widget
    }
  }
  zoomTo('World'); // Default zoom to World
}