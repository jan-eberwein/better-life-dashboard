// src/map.ts
import * as d3 from 'd3';

export interface DrawMapOptions {
  containerId: string;
  csvUrl?: string;
  geojsonUrl?: string;
}

interface DataRecord {
  country: string;
  flag: string;
  value: number;
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
  if (!container) throw new Error(`Container '#${opts.containerId}' not found`);
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Load CSV and GeoJSON
  const [rawCsv, worldGeo] = await Promise.all([
    d3.csv<Record<string,string>>(opts.csvUrl),
    d3.json<GeoJSON.FeatureCollection<GeoJSON.Geometry>>(opts.geojsonUrl)
  ]);

  // Parse records
  const data: DataRecord[] = rawCsv.map(row => {
    const t: Record<string,string> = {};
    Object.entries(row).forEach(([k,v]) => t[k.trim()] = v);
    return {
      country:    t['Country'],
      flag:       t['Flag'],
      value:      +t['Life satisfaction'],
      gdp:        +t['GDP per capita (USD)'],
      leisure:    +t['Time devoted to leisure and personal care'],
      rooms:      +t['Rooms per person'],
      population: +t['Population']
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
  const controls = d3.select(container)
      .append('div')
      .attr('id', 'controls');
  controls.append('label')
      .attr('for', 'region-select')
      .text('Region:');
  const select = controls.append('select')
      .attr('id', 'region-select')
      .on('change', () => zoomTo(select.property('value')));
  ['World','Europe','Africa','Asia','Americas','Oceania']
      .forEach(r => select.append('option').attr('value', r).text(r));

  // Country detail widget (initially prompt)
  const widget = d3.select(container)
      .append('div')
      .attr('id', 'country-widget')
      .html('<em>Click a country to see details</em>');

  // SVG map
  const svg = d3.select(container)
      .append('svg')
      .attr('id', 'map-svg')
      .attr('width', width)
      .attr('height', height - 60);

  const projection = d3.geoNaturalEarth1()
      .scale(width / (1.3 * Math.PI))
      .translate([width / 2, (height - 60) / 2]);
  const path = d3.geoPath(projection);

  // Tooltip
  const tooltip = d3.select(container)
      .append('div')
      .attr('id', 'tooltip')
      .classed('hidden', true);
  d3.select(container).on('mouseleave', () => tooltip.classed('hidden', true));

  // Color scale
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([d3.min(data, d => d.value)!, d3.max(data, d => d.value)!]);

  // Draw countries
  const g = svg.append('g');
  g.selectAll('path.country')
      .data(worldGeo!.features)
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('d', path as any)
      .attr('fill', d => {
        const rec = data.find(p => p.country === d.properties!.name);
        return rec ? colorScale(rec.value) : '#eee';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .on('mouseover', (_, d) => showTooltip(d))
      .on('mousemove', moveTooltip)
      .on('mouseout', () => tooltip.classed('hidden', true))
      .on('click', (_, d) => {
        const rec = data.find(p => p.country === d.properties!.name);
        if (rec) updateWidget(rec);
      });

  // Zoom behavior
  const zoom = d3.zoom<SVGSVGElement,unknown>()
      .scaleExtent([1,8])
      .on('zoom', e => g.attr('transform', e.transform));
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
    const [[x0,y0],[x1,y1]] = boxes[region];
    const p0 = projection([x0, y1])!;
    const p1 = projection([x1, y0])!;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const xC = (p0[0] + p1[0]) / 2;
    const yC = (p0[1] + p1[1]) / 2;
    const scale = Math.min(width/dx, (height-60)/dy) * 0.8;
    const translate: [number,number] = [ width/2 - scale*xC, (height-60)/2 - scale*yC ];
    svg.transition().duration(750)
        .call(zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
  }

  // Tooltip & radar
  function showTooltip(d: GeoJSON.Feature<GeoJSON.Geometry>) {
    const rec = data.find(p => p.country === d.properties!.name)!;
    tooltip.html(
        `<div class="tooltip-header">
         <span class="flag">${rec.flag}</span>
         <span class="name">${rec.country}</span>
         <span class="pop">${(rec.population/1e6).toFixed(2)}M</span>
       </div>
       <div class="tooltip-metric">
         Life satisfaction: <span class="ls-value" style="color:${colorScale(rec.value)}">${rec.value}</span>
       </div>`
    )
        .classed('hidden', false);

    // Radar chart comparing to OECD average
    tooltip.selectAll('.tooltip-chart').remove();
    const rc = tooltip.append('div').attr('class','tooltip-chart');
    const indicators: (keyof DataRecord)[] = ['value','gdp','leisure','rooms'];
    const angleStep = 2 * Math.PI / indicators.length;
    const W = 150, H = 150, margin = 20;
    const R = Math.min(W, H) / 2 - margin;

    // Compute extents for each indicator
    const extents = new Map<keyof DataRecord, [number, number]>(
        indicators.map(ind => [ind, [
          d3.min(data, d => d[ind])!,
          d3.max(data, d => d[ind])!
        ]])
    );

    // Prepare radar data for selected country and OECD avg
    type Point = { angle: number; ratio: number };
    const radarData: { country: string; points: Point[] }[] = [
      { country: rec.country, points: [] },
      { country: 'OECD', points: [] }
    ];
    indicators.forEach((ind, i) => {
      const [lo, hi] = extents.get(ind)!;
      const scaleNorm = (lo === hi)
          ? d3.scaleLinear([lo - 1, hi + 1], [0, 1])
          : d3.scaleLinear([lo, hi], [0, 1]);
      const valRec = rec[ind];
      const avg = oecdAvg[ind as keyof typeof oecdAvg];
      radarData[0].points.push({ angle: i * angleStep, ratio: scaleNorm(valRec) });
      radarData[1].points.push({ angle: i * angleStep, ratio: scaleNorm(avg) });
    });

    // Create SVG for radar
    const svgR = rc.append('svg')
        .attr('width', W)
        .attr('height', H)
        .append('g')
        .attr('transform', `translate(${W/2},${H/2})`);

    // Draw concentric circles
    const levels = 4;
    for (let lvl = 1; lvl <= levels; lvl++) {
      svgR.append('circle')
          .attr('r', R * lvl / levels)
          .attr('fill', 'none')
          .attr('stroke', '#ccc');
    }

    // Draw axes and labels
    indicators.forEach((ind, i) => {
      const ang = i * angleStep - Math.PI/2;
      const x = R * Math.cos(ang);
      const y = R * Math.sin(ang);
      svgR.append('line')
          .attr('x1', 0).attr('y1', 0)
          .attr('x2', x).attr('y2', y)
          .attr('stroke', '#999');
      svgR.append('text')
          .attr('x', (R + 10) * Math.cos(ang))
          .attr('y', (R + 10) * Math.sin(ang))
          .attr('dy', '0.35em')
          .attr('text-anchor', Math.cos(ang) > 0 ? 'start' : 'end')
          .style('font-size', '9px')
          .text(ind === 'value' ? 'Life' : ind.charAt(0).toUpperCase()+ind.slice(1));
    });

    // Scale for radius
    const rScale = d3.scaleLinear([0, 1], [0, R]);
    const lineGen = d3.lineRadial<Point>()
        .angle(d => d.angle - Math.PI/2)
        .radius(d => rScale(d.ratio))
        .curve(d3.curveLinearClosed);

    // Colors: selected country red, OECD green
    const colorRadar = d3.scaleOrdinal<string>()
        .domain(radarData.map(d => d.country))
        .range(['#e41a1c', '#4daf4a']);

    radarData.forEach(series => {
      svgR.append('path')
          .datum(series.points)
          .attr('d', lineGen as any)
          .attr('fill', colorRadar(series.country))
          .attr('fill-opacity', 0.3)
          .attr('stroke', colorRadar(series.country))
          .attr('stroke-width', 1.5);
    });
    //legend
    const legend = rc.append('div').attr('class','tooltip-legend');
    const legendItems = [
      { color: '#e41a1c', label: rec.country },
      { color: '#4daf4a', label: 'OECD avg' }
    ];
    const legendList = legend.append('ul');
    legendItems.forEach(item => {
          const li = legendList.append('li');
          li.append('span')
              .attr('class', 'legend-color')
              .style('background-color', item.color);
          li.append('span')
              .attr('class', 'legend-label')
              .text(item.label);
        }
    );
  }

  function moveTooltip(event: MouseEvent) {
    tooltip
        .style('left', `${event.pageX + 10}px`)
        .style('top',  `${event.pageY + 10}px`);
  }

  // Update widget with country vs OECD avg
  function updateWidget(rec: DataRecord) {
    widget.html('');
    const header = widget.append('div').attr('class','widget-header');
    header.append('span').attr('class','flag').text(rec.flag);
    header.append('span').attr('class','country-name').text(rec.country);
    header.append('span').attr('class','pop').text(`Pop: ${(rec.population/1e6).toFixed(2)}M`);
    const list = widget.append('ul').attr('class','widget-metrics');
    // Life satisfaction colored
    list.append('li')
        .html(`Life satisfaction: <span class="ls-value" style="color:${colorScale(rec.value)}">${rec.value}</span>`);
    // Other metrics and comparison
    ['gdp','leisure','rooms'].forEach(key => {
      const label = key==='gdp'? 'GDP per capita': key==='leisure'? 'Leisure hrs/day': 'Rooms per person';
      const val = rec[key as keyof DataRecord] as number;
      const avg = oecdAvg[key as keyof typeof oecdAvg];
      list.append('li')
          .text(`${label}: ${val} (Avg: ${avg.toFixed(1)})`);
    });
  }
}
