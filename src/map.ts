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

    // Radar data
    const metrics = [
      { key: 'value', avg: oecdAvg.value },
      { key: 'gdp',   avg: oecdAvg.gdp },
      { key: 'leisure', avg: oecdAvg.leisure },
      { key: 'rooms',  avg: oecdAvg.rooms }
    ];
    const radarData = metrics.map((m,i) => ({
      angle: (i / metrics.length) * 2 * Math.PI,
      radius: rec[m.key as keyof DataRecord] / m.avg
    }));
    const rMax = 30;
    const rScale = d3.scaleLinear()
      .domain([0, d3.max(radarData, d => d.radius)!])
      .range([0, rMax]);
    const radialLine = d3.lineRadial<[number,number]>()
      .angle(d => d[0])
      .radius(d => rScale(d[1]))
      .curve(d3.curveLinearClosed);
    const svgR = tooltip.append('svg')
      .attr('class','tooltip-chart')
      .attr('width', rMax*2+20)
      .attr('height', rMax*2+20)
      .append('g')
      .attr('transform', `translate(${rMax+10},${rMax+10})`);
    svgR.append('path')
      .datum(radarData.map(d => [d.angle,d.radius] as [number,number]))
      .attr('d', radialLine as any)
      .attr('fill', 'rgba(50,150,250,0.3)')
      .attr('stroke', '#3498db')
      .attr('stroke-width', 1);
  }

  function moveTooltip(event: MouseEvent) {
    tooltip
      .style('left', `${event.pageX+10}px`)
      .style('top', `${event.pageY+10}px`);
  }

  // Update widget with country vs OECD avg
  function updateWidget(rec: DataRecord) {
    widget.html('');
    const header = widget.append('div').attr('class','widget-header');
    header.append('span').attr('class','flag').text(rec.flag);
    header.append('span').attr('class','country-name').text(rec.country);
    header.append('span').attr('class','pop').text(`Population: ${(rec.population/1e6).toFixed(2)}M`);
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