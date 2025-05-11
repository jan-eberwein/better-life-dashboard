// src/map.ts
import * as d3 from 'd3';
import type { Feature, FeatureCollection, Geometry } from 'geojson'; // Ensure GeoJSON types are imported

export interface DrawMapOptions {
  containerId: string;
  csvUrl?: string;
  geojsonUrl?: string;
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

// Define a type for the properties of GeoJSON features if they are consistent
interface CountryProperties {
  name: string;
  // Add other properties if they exist and are used, e.g., iso_a2, etc.
}


export async function drawMap(
    containerId: string,
    options?: DrawMapOptions
): Promise<void> {
  const opts = {
    containerId,
    csvUrl: options?.csvUrl ?? '/data/2024BetterLife.csv', // Path relative to public directory
    geojsonUrl: options?.geojsonUrl ?? '/data/world.geojson' // Path relative to public directory
  };

  // Container & dimensions
  const container = document.getElementById(opts.containerId);
  if (!container) {
    console.error(`Map container '#${opts.containerId}' not found`);
    return;
  }
  // Clear previous content if any
  container.innerHTML = '';


  const width = container.clientWidth;
  // Ensure height is reasonable, fallback if clientHeight is 0
  const height = container.clientHeight > 50 ? container.clientHeight : 500;


  // Load CSV and GeoJSON
  const [rawCsv, worldGeo] = await Promise.all([
    d3.csv(opts.csvUrl) as Promise<d3.DSVRowArray<string>>, // More specific type
    d3.json(opts.geojsonUrl) as Promise<FeatureCollection<Geometry, CountryProperties>>
  ]);

  if (!rawCsv || !worldGeo) {
    console.error("Failed to load map data.");
    return;
  }

  // Parse records
  const data: DataRecord[] = rawCsv.map(row => {
    const t: Record<string, string | undefined> = {}; // Allow undefined for robustness
    Object.entries(row).forEach(([k,v]) => t[k.trim()] = v);
    return {
      country:    t['Country'] || 'Unknown',
      flag:       t['Flag'] || '🏳️',
      value:      +t['Life satisfaction']! || 0,
      gdp:        +t['GDP per capita (USD)']! || 0,
      leisure:    +t['Time devoted to leisure and personal care']! || 0,
      rooms:      +t['Rooms per person']! || 0,
      population: +t['Population']! || 0
    };
  });

  // Compute OECD averages
  const oecdAvg = {
    value:   d3.mean(data, d => d.value)!,
    gdp:     d3.mean(data, d => d.gdp)!,
    leisure: d3.mean(data, d => d.leisure)!,
    rooms:   d3.mean(data, d => d.rooms)!
  };

  // Controls (region dropdown)
  const controlsDiv = d3.select(container)
      .append('div')
      .attr('id', 'controls') // Used by CSS
      .style('margin-bottom', '10px'); // Some spacing

  controlsDiv.append('label')
      .attr('for', 'region-select')
      .text('Region: ')
      .style('margin-right', '5px');

  const select = controlsDiv.append('select')
      .attr('id', 'region-select')
      .on('change', (event: Event) => {
        const target = event.target as HTMLSelectElement;
        zoomTo(target.value);
      });

  ['World','Europe','Africa','Asia','Americas','Oceania']
      .forEach(r => select.append('option').attr('value', r).text(r));

  // Country detail widget (initially prompt)
  const widget = d3.select(container)
      .append('div')
      .attr('id', 'country-widget') // Used by CSS
      .html('<em>Click a country to see details</em>');

  // SVG map
  const svg = d3.select(container)
      .append('svg')
      .attr('id', 'map-svg') // Good for targeting if needed
      .attr('width', width)
      .attr('height', height - (controlsDiv.node()?.offsetHeight || 0) - (widget.node()?.offsetHeight || 0) - 20) // Adjust height based on controls/widget
      .attr('viewBox', `0 0 ${width} ${height - (controlsDiv.node()?.offsetHeight || 0) - (widget.node()?.offsetHeight || 0) - 20}`);


  const projection = d3.geoNaturalEarth1()
      .fitSize([width, height - (controlsDiv.node()?.offsetHeight || 0) - (widget.node()?.offsetHeight || 0) - 20], worldGeo)
      .scale(width / (1.3 * Math.PI)) // Initial scale might need adjustment or fitSize will override
      .translate([width / 2, (height - (controlsDiv.node()?.offsetHeight || 0) - (widget.node()?.offsetHeight || 0) - 20) / 2]);

  const pathGenerator = d3.geoPath(projection);

  // Tooltip
  const tooltip = d3.select(container) // Append to map container for relative positioning
      .append('div')
      .attr('id', 'tooltip') // Used by CSS, matches old version
      .style('opacity', 0) // Start hidden
      .style('position', 'absolute') // Crucial for positioning
      .style('pointer-events', 'none'); // So it doesn't interfere with map events


  // Color scale
  const lifeSatisfactionValues = data.map(d => d.value).filter(v => !isNaN(v));
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain(d3.extent(lifeSatisfactionValues) as [number, number]);

  // Draw countries
  const g = svg.append('g');
  g.selectAll('path.country')
      .data(worldGeo.features)
      .join('path')
      .attr('class', 'country')
      .attr('d', pathGenerator as any)
      .attr('fill', (d: Feature<Geometry, CountryProperties>) => {
        const rec = data.find(p => p.country === d.properties!.name);
        return rec && !isNaN(rec.value) ? colorScale(rec.value) : '#eee';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mouseover', function(event: MouseEvent, d: Feature<Geometry, CountryProperties>) { // Use function for `this`
        d3.select(this).attr('stroke-width', 1.5).attr('stroke', '#333');
        showTooltip(event, d);
      })
      .on('mousemove', function(event: MouseEvent) { // Use function for `this`
        moveTooltip(event);
      })
      .on('mouseout', function() { // Use function for `this`
        d3.select(this).attr('stroke-width', 0.5).attr('stroke', '#fff');
        tooltip.style('opacity', 0);
      })
      .on('click', (event: MouseEvent, d: Feature<Geometry, CountryProperties>) => {
        const rec = data.find(p => p.country === d.properties!.name);
        if (rec) {
          updateWidget(rec);
          localStorage.setItem('bli-selected-country', rec.country); // For dashboard pre-selection
        }
      });

  // Zoom behavior
  const zoom = d3.zoom<SVGSVGElement,unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
  svg.call(zoom);

  // Zoom to region
  function zoomTo(region: string) {
    const boxes: Record<string, [[number,number],[number,number]]> = {
      World:   [[-180,-90],[180,90]],
      Europe:  [[-25,34],[40,71]],
      Africa:  [[-20,-35],[55,38]],
      Asia:    [[25,-10],[180,80]],
      Americas:[[-170,-60],[-30,85]],
      Oceania: [[110,-50],[180,10]]
    };
    const [[x0,y0],[x1,y1]] = boxes[region] || boxes['World']; // Fallback to World

    // Calculate bounding box in projected coordinates
    // Note: d3.geoPath().bounds(feature) is more robust for complex shapes than just projecting corners.
    // However, for simple lat/lon boxes, projecting corners can work.
    // For simplicity here, we'll use the provided logic, but it might need refinement for perfect fit.
    const p0 = projection([x0, y1])!;
    const p1 = projection([x1, y0])!;

    const boundsWidth = Math.abs(p1[0] - p0[0]);
    const boundsHeight = Math.abs(p1[1] - p0[1]);
    const svgDrawingAreaHeight = height - (controlsDiv.node()?.offsetHeight || 0) - (widget.node()?.offsetHeight || 0) - 20;


    const scale = 0.9 * Math.min(width / boundsWidth, svgDrawingAreaHeight / boundsHeight);
    const translate: [number,number] = [
      width / 2 - scale * (p0[0] + p1[0]) / 2,
      svgDrawingAreaHeight / 2 - scale * (p0[1] + p1[1]) / 2
    ];

    svg.transition().duration(750)
        .call(zoom.transform as any, // Type assertion for zoom.transform
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
  }

  // Tooltip & radar
  function showTooltip(event: MouseEvent, d: Feature<Geometry, CountryProperties>) {
    const rec = data.find(p => p.country === d.properties!.name);
    if (!rec) return;

    tooltip.html('') // Clear previous content
        .style('opacity', 0.9);

    const header = tooltip.append('div').attr('class','tooltip-header');
    header.append('span').attr('class','flag').text(rec.flag);
    header.append('span').attr('class','name').text(rec.country);
    header.append('span').attr('class','pop').text(`${(rec.population/1e6).toFixed(2)}M`);

    tooltip.append('div').attr('class','tooltip-metric')
        .html(`Life satisfaction: <span class="ls-value" style="color:${colorScale(rec.value)}">${rec.value.toFixed(1)}</span>`);

    // Radar chart comparing to OECD average
    const rcContainer = tooltip.append('div').attr('class','tooltip-chart');
    const indicators: (keyof DataRecord)[] = ['value','gdp','leisure','rooms']; // Using keys of DataRecord
    const angleStep = 2 * Math.PI / indicators.length;
    const W = 120, H = 120, margin = 15; // Smaller radar for tooltip
    const R = Math.min(W, H) / 2 - margin;

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
      if (!extentPair) return;
      const [lo, hi] = extentPair;
      const scaleNorm = (lo === hi)
          ? d3.scaleLinear([lo - 1, hi + 1 || 1], [0, 1]) // Ensure hi+1 is not lo-1+1 if lo=0
          : d3.scaleLinear([lo, hi], [0, 1]);
      const valRec = rec[ind] as number; // Cast to number
      const avg = oecdAvg[ind as keyof typeof oecdAvg]; // Ensure ind is a valid key for oecdAvg
      radarPlotData[0].points.push({ angle: i * angleStep, ratio: scaleNorm(valRec) });
      radarPlotData[1].points.push({ angle: i * angleStep, ratio: scaleNorm(avg) });
    });

    const svgR = rcContainer.append('svg')
        .attr('width', W)
        .attr('height', H)
        .append('g')
        .attr('transform', `translate(${W/2},${H/2})`);

    const levels = 3; // Fewer levels for smaller radar
    for (let lvl = 1; lvl <= levels; lvl++) {
      svgR.append('circle')
          .attr('r', R * lvl / levels)
          .attr('fill', 'none')
          .attr('stroke', '#ccc');
    }

    indicators.forEach((ind, i) => {
      const ang = i * angleStep - Math.PI/2;
      const x = R * Math.cos(ang);
      const y = R * Math.sin(ang);
      svgR.append('line')
          .attr('x1', 0).attr('y1', 0)
          .attr('x2', x).attr('y2', y)
          .attr('stroke', '#bbb').attr('stroke-dasharray', '2,2'); // Lighter, dashed axes
      svgR.append('text')
          .attr('x', (R + 8) * Math.cos(ang)) // Closer labels
          .attr('y', (R + 8) * Math.sin(ang))
          .attr('dy', '0.35em')
          .attr('text-anchor', Math.abs(Math.cos(ang)) < 0.1 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end'))
          .style('font-size', '8px') // Smaller font
          .text(ind === 'value' ? 'LifeSat' : ind.charAt(0).toUpperCase()+ind.slice(1,4)); // Shorter labels
    });

    const rScale = d3.scaleLinear([0, 1], [0, R]);
    const lineGen = d3.lineRadial<Point>()
        .angle(d => d.angle - Math.PI/2)
        .radius(d => rScale(d.ratio))
        .curve(d3.curveLinearClosed);

    const colorRadar = d3.scaleOrdinal<string>()
        .domain(radarPlotData.map(d => d.country))
        .range(['#e41a1c', '#4daf4a']); // Country, OECD

    radarPlotData.forEach(series => {
      svgR.append('path')
          .datum(series.points)
          .attr('d', lineGen as any)
          .attr('fill', colorRadar(series.country))
          .attr('fill-opacity', 0.3)
          .attr('stroke', colorRadar(series.country))
          .attr('stroke-width', 1.5);
    });

    // Legend for tooltip radar
    const legendContainer = tooltip.append('div').attr('class', 'tooltip-legend');
    const legendList = legendContainer.append('ul').style('list-style', 'none').style('padding-left', '0').style('margin-top', '5px');
    radarPlotData.forEach(series => {
      const li = legendList.append('li').style('display', 'inline-flex').style('align-items', 'center').style('margin-right', '10px');
      li.append('span')
          .style('display', 'inline-block')
          .style('width', '10px')
          .style('height', '10px')
          .style('background-color', colorRadar(series.country))
          .style('margin-right', '4px');
      li.append('span').text(series.country === 'OECD' ? 'OECD Avg.' : series.country).style('font-size', '9px');
    });

    moveTooltip(event); // Position after content is set
  }

  function moveTooltip(event: MouseEvent) {
    const tooltipNode = tooltip.node() as HTMLElement;
    if (!tooltipNode) return;

    let x = event.pageX + 15;
    let y = event.pageY + 15;

    // Boundary collision detection
    if (x + tooltipNode.offsetWidth > window.innerWidth) {
      x = event.pageX - 15 - tooltipNode.offsetWidth;
    }
    if (y + tooltipNode.offsetHeight > window.innerHeight) {
      y = event.pageY - 15 - tooltipNode.offsetHeight;
    }
    if (y < 0) { // Ensure tooltip doesn't go off the top of the screen
      y = 15;
    }


    tooltip
        .style('left', `${x}px`)
        .style('top',  `${y}px`);
  }

  // Update widget with country vs OECD avg
  function updateWidget(rec: DataRecord) {
    widget.html(''); // Clear previous
    const header = widget.append('div').attr('class','widget-header');
    header.append('span').attr('class','flag').text(rec.flag);
    header.append('span').attr('class','country-name').text(rec.country);
    header.append('span').attr('class','pop').text(`Pop: ${(rec.population/1e6).toFixed(2)}M`);

    const list = widget.append('ul').attr('class','widget-metrics');
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
  const savedCountryFeature = savedCountryName ? worldGeo.features.find(f => f.properties!.name === savedCountryName) : null;

  if (savedCountryFeature) {
    // This is a simplified zoom; a proper zoomToFeature would be more robust.
    // For now, just select the country in the dropdown if it exists and update the widget.
    const rec = data.find(p => p.country === savedCountryName);
    if (rec) updateWidget(rec);
    // If you want to zoom to the country, you'd need a way to get its bounding box
    // or use a pre-defined bounding box for each country.
    // For now, we default to 'World' zoom.
    zoomTo('World');

  } else {
    zoomTo('World'); // Default zoom
  }
}