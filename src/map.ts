// src/map.ts
import * as d3 from 'd3';
import type { FeatureCollection, Geometry } from 'geojson';

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

  const container = document.getElementById(opts.containerId);
  if (!container) throw new Error(`Container '#${opts.containerId}' not found`);
  const width = container.clientWidth;
  const height = container.clientHeight;

  // load CSV & GeoJSON
  const rawCsv = await d3.csv(opts.csvUrl) as Array<Record<string,string>>;
  const worldGeo = await d3.json(opts.geojsonUrl) as FeatureCollection<Geometry>;

  // parse
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

  const oecdAvg = {
    value:   d3.mean(data, d => d.value)!,
    gdp:     d3.mean(data, d => d.gdp)!,
    leisure: d3.mean(data, d => d.leisure)!,
    rooms:   d3.mean(data, d => d.rooms)!
  };

  // controls, widget, SVG setup omitted for brevity…

  // draw countries
  const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height - 60);
  const projection = d3.geoNaturalEarth1()
      .scale(width / (1.3 * Math.PI))
      .translate([width/2, (height-60)/2]);
  const path = d3.geoPath(projection);

  const g = svg.append('g');
  g.selectAll('path.country')
      .data(worldGeo.features)
      .enter()
      .append('path')
      .attr('class','country')
      .attr('d', path as any)
      .attr('fill', d => {
        const rec = data.find(p => p.country === d.properties!.name);
        return rec ? d3.interpolateRdYlGn(rec.value) : '#eee';
      })
      .attr('stroke','#fff')
      .attr('stroke-width',0.5)
      .on('click', (_, d) => {
        const rec = data.find(p => p.country === d.properties!.name);
        if (rec) {
          updateWidget(rec);
          // store selection for dashboard pre-selection
          localStorage.setItem('bli-selected-country', rec.country);
        }
      });

  // … rest of drawMap (tooltips, zoom, updateWidget) stays the same
}
