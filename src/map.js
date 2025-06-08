// src/map.js
import * as d3 from "d3";

// Category definitions
const GROUPS = {
  "Housing": [
    "Dwellings without basic facilities",
    "Housing expenditure",
    "Rooms per person"
  ],
  "Income": [
    "GDP per capita (USD)",
    "Household net adjusted disposable income",
    "Household net wealth",
    "Personal earnings"
  ],
  "Jobs": [
    "Labour market insecurity",
    "Employment rate",
    "Long-term unemployment rate"
  ],
  "Community": [
    "Quality of support network"
  ],
  "Education": [
    "Educational attainment",
    "Student skills",
    "Years in education"
  ],
  "Environment": [
    "Air pollution",
    "Water quality"
  ],
  "Civic Engagement": [
    "Stakeholder engagement for developing regulations",
    "Voter turnout"
  ],
  "Health": [
    "Life expectancy",
    "Self-reported health"
  ],
  "Life Satisfaction": [
    "Life satisfaction"
  ],
  "Safety": [
    "Feeling safe walking alone at night",
    "Homicide rate"
  ],
  "Work-Life Balance": [
    "Employees working very long hours",
    "Time devoted to leisure and personal care"
  ]
};

// Alias GeoJSON names to CSV
const GEO_TO_CSV = {
  "United Arab Emirates": "United Arab Emirates",
  "United Republic of Tanzania": "United Republic of Tanzania",
  "USA": "United States",
  "England": "United Kingdom"
};

export async function drawMap(containerId, options) {
  // Inject styles for widgets, tooltip, legend
  if (!document.getElementById('map-widget-styles')) {
    const s = document.createElement('style');
    s.id = 'map-widget-styles';
    s.textContent = `
#widget-wrapper {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: flex-start;
}
#widget-wrapper > div {
  flex: 1;
  background: #f9f9f9;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 180px;
  overflow: auto;
}
.widget-columns {
  display: flex;
  gap: 12px;
}
.widget-columns .col {
  flex: 1;
}
.widget-header {
  font-weight: bold;
  margin-bottom: 4px;
}
.widget-label {
  font-weight: 500;
}
.tooltip-chart {
  text-align: center;
}
.tooltip-chart svg {
  display: inline-block;
}
.radar-legend {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 10px;
}
.radar-legend .legend-swatch {
  width: 12px;
  height: 12px;
  display: inline-block;
}
`;    
    document.head.appendChild(s);
  }

  const cfg = {
    containerId,
    csvUrl: options?.csvUrl || "/data/2024BetterLife.csv",
    geojsonUrl: options?.geojsonUrl || "/data/world.geojson"
  };

  const container = document.getElementById(cfg.containerId);
  if (!container) throw new Error(`Container '#${cfg.containerId}' not found`);
  container.innerHTML = "";

  // Top widgets
  const widgetWrapper = document.createElement('div');
  widgetWrapper.id = 'widget-wrapper';
  container.appendChild(widgetWrapper);

  const homeBox = document.createElement('div');
  homeBox.id = 'home-country-box';
  homeBox.innerHTML = '<em>Home country:<br>None</em>';
  widgetWrapper.appendChild(homeBox);

  const selBox = document.createElement('div');
  selBox.id = 'selected-country-box';
  selBox.innerHTML = '<em>Select a country<br>for details</em>';
  widgetWrapper.appendChild(selBox);

  // Region controls
  const controls = document.createElement('div');
  controls.id = 'controls';
  controls.style.marginBottom = '8px';
  container.appendChild(controls);
  const lbl = document.createElement('label');
  lbl.htmlFor = 'region-select';
  lbl.textContent = 'Region:';
  controls.appendChild(lbl);
  const select = document.createElement('select');
  select.id = 'region-select';
  select.style.marginLeft = '4px';
  ['World','Europe','Africa','Asia','Americas','Oceania'].forEach(r => {
    const o = document.createElement('option');
    o.value = r; o.textContent = r;
    select.appendChild(o);
  });
  select.onchange = () => zoomTo(select.value);
  controls.appendChild(select);

  // Dimensions
  const width = container.clientWidth;
  const height = container.clientHeight - widgetWrapper.offsetHeight - controls.offsetHeight;

  // Load data
  const [rawCsv, geo] = await Promise.all([
    d3.csv(cfg.csvUrl),
    d3.json(cfg.geojsonUrl)
  ]);

  // Parse CSV, metrics
  const data = rawCsv.map(r => {
    const t = {};
    Object.entries(r).forEach(([k,v]) => t[k.trim()] = v);
    const rec = { country: t['Country'], flag: t['Flag'], population: +t['Population'] };
    Object.values(GROUPS).flat().forEach(col => rec[col] = +t[col]);
    rec.groupAvg = {};
    Object.entries(GROUPS).forEach(([g,cols]) => {
      const vals = cols.map(c=>rec[c]).filter(v=>!isNaN(v));
      rec.groupAvg[g] = vals.length?d3.mean(vals):0;
    });
    return rec;
  });

  // Compute OECD raw averages for radar
  const indicators = [
    'Life satisfaction',
    'GDP per capita (USD)',
    'Time devoted to leisure and personal care',
    'Rooms per person'
  ];
  const oecdRawAvg = {};
  indicators.forEach(ind => {
    const all = data.map(d=>d[ind]).filter(v=>!isNaN(v));
    oecdRawAvg[ind] = all.length?d3.mean(all):0;
  });

  // Load home from storage
  let homeRec = null;
  const stored = localStorage.getItem('bli-selected-country');
  if (stored) {
    homeRec = data.find(d=>d.country===stored);
    if (homeRec) updateComparisonWidgets(homeRec, null);
  }

  // SVG map
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('display','block');

  const projection = d3.geoNaturalEarth1()
    .scale(width/(1.3*Math.PI))
    .translate([width/2, height/2]);
  const path = d3.geoPath(projection);

  // Tooltip
  const tooltip = d3.select(container)
    .append('div').attr('id','tooltip').classed('hidden',true)
    .style('position','absolute').style('pointer-events','none')
    .style('background','rgba(255,255,255,0.95)')
    .style('padding','8px').style('border','1px solid #999')
    .style('border-radius','4px').style('font','12px Raleway,sans-serif')
    .style('z-index','3');
  svg.on('mouseleave',()=>tooltip.classed('hidden',true));

  // Color scale
  const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([d3.min(data,d=>d['Life satisfaction']), d3.max(data,d=>d['Life satisfaction'])]);

  // Draw countries
  const g = svg.append('g');
  g.selectAll('path.country').data(geo.features).enter()
    .append('path').attr('class','country').attr('d',path)
    .attr('fill',f=>{
      const nm=f.properties.name;
      const cn=GEO_TO_CSV[nm]||nm;
      const r=data.find(d=>d.country===cn);
      return r?colorScale(r['Life satisfaction']):'#eee';
    })
    .attr('stroke','#fff').attr('stroke-width',0.5)
    .on('mouseover',(_,f)=>showTooltip(f))
    .on('mousemove',moveTooltip)
    .on('mouseout',()=>tooltip.classed('hidden',true))
    .on('click',(_,f)=>{
      const nm=f.properties.name;
      const cn=GEO_TO_CSV[nm]||nm;
      const r=data.find(d=>d.country===cn);
      if(r) {
        updateComparisonWidgets(homeRec,r);
        if(!homeRec) {
          homeRec=r;
          localStorage.setItem('bli-selected-country',r.country);
          updateComparisonWidgets(homeRec,null);
        }
      }
    });

  // Legend - life satisfaction
  const legend = svg.append('g')
    .attr('transform',`translate(${width-200},${height-80})`);
  legend.append('rect')
    .attr('x',-10).attr('y',-10)
    .attr('width',180).attr('height',80)
    .attr('fill','rgba(255,255,255,0.9)')
    .attr('stroke','#ccc').attr('stroke-width',1).attr('rx',4);
  legend.append('text')
    .attr('x',85).attr('y',8).attr('text-anchor','middle')
    .style('font-weight','bold').style('font-size','12px').style('fill','#333')
    .text('Life Satisfaction');
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id','legend-gradient')
    .attr('x1','0%').attr('x2','100%').attr('y1','0%').attr('y2','0%');
  const ext = d3.extent(data, d=>d['Life satisfaction']);
  for(let i=0;i<=10;i++){
    const v = ext[0] + (ext[1]-ext[0])*(i/10);
    grad.append('stop').attr('offset',`${(i/10)*100}%`).attr('stop-color',colorScale(v));
  }
  const lw=140, lh=15;
  legend.append('rect')
    .attr('x',15).attr('y',15).attr('width',lw).attr('height',lh)
    .style('fill','url(#legend-gradient)').attr('stroke','#999').attr('stroke-width',0.5);
  const axisScale = d3.scaleLinear().domain(ext).range([15,15+lw]);
  const axis = d3.axisBottom(axisScale).ticks(4).tickSize(3).tickFormat(d=>d.toFixed(1));
  legend.append('g').attr('transform',`translate(0,${15+lh})`).call(axis)
    .selectAll('text').style('font-size','10px').style('fill','#666');

  // Zoom behavior
  const zoom = d3.zoom().scaleExtent([1,8]).on('zoom',e=>g.attr('transform',e.transform));
  svg.call(zoom);
  select.value = 'World';
  zoomTo('World');

  // Helpers
  function zoomTo(region) {
    const boxes = {
      World: [[-180,-90],[180,90]],
      Europe: [[-25,34],[40,71]],
      Africa: [[-20,-35],[55,38]],
      Asia: [[25,-10],[180,80]],
      Americas: [[-170,-60],[-30,85]],
      Oceania: [[110,-50],[180,10]]
    };
    const [[x0,y0],[x1,y1]] = boxes[region];
    const p0 = projection([x0,y1]);
    const p1 = projection([x1,y0]);
    const dx = p1[0]-p0[0], dy = p1[1]-p0[1];
    const xC = (p0[0]+p1[0])/2, yC = (p0[1]+p1[1])/2;
    const s = Math.min(width/dx, height/dy)*0.8;
    const t = [width/2 - s*xC, height/2 - s*yC];
    svg.transition().duration(750)
      .call(zoom.transform, d3.zoomIdentity.translate(t[0],t[1]).scale(s));
  }

  function showTooltip(feat) {
    const nm = feat.properties.name;
    const cn = GEO_TO_CSV[nm]||nm;
    const rec = data.find(d=>d.country===cn);
    if(!rec) return;

    // Radar chart compute
    const angleStep = 2*Math.PI/indicators.length;
    const W=120, H=120, m=10;
    const R=Math.min(W,H)/2 - m;
    const extMap = new Map(indicators.map(ind=>[
      ind,
      [d3.min(data,d=>d[ind]), d3.max(data,d=>d[ind])]
    ]));
    function computePts(record){
      return indicators.map((ind,i)=>{
        const [lo,hi] = extMap.get(ind);
        const norm = lo===hi
          ? d3.scaleLinear().domain([lo-1,hi+1]).range([0,1])
          : d3.scaleLinear().domain([lo,hi]).range([0,1]);
        return { angle: i*angleStep, ratio: norm(record[ind]) };
      });
    }
    const ptsRec = computePts(rec);
    const ptsOecd = computePts(oecdRawAvg);
    function polyD(pts){
      let d='';
      pts.forEach((p,i)=>{
        const a = p.angle - Math.PI/2;
        const r = R*p.ratio;
        const x = r*Math.cos(a), y = r*Math.sin(a);
        d += (i===0?'M':'L') + x + ',' + y;
      });
      return d+'Z';
    }
    let svgHtml = `<svg width="${W}" height="${H}"><g transform="translate(${W/2},${H/2})">`;
    for(let lvl=1;lvl<=4;lvl++) svgHtml += `<circle r="${(R*lvl/4)}" fill="none" stroke="#ccc"/>`;
    indicators.forEach((ind,i)=>{
      const ang = i*angleStep - Math.PI/2;
      const xA = R*Math.cos(ang), yA = R*Math.sin(ang);
      svgHtml += `<line x1="0" y1="0" x2="${xA}" y2="${yA}" stroke="#999"/>`;
      const lx = (R+12)*Math.cos(ang), ly = (R+12)*Math.sin(ang);
      const lbl = ind==="Life satisfaction" ? "Life"
                 : ind==="GDP per capita (USD)" ? "GDP"
                 : ind==="Time devoted to leisure and personal care" ? "Leisure"
                 : "Rooms";
      svgHtml += `<text x="${lx}" y="${ly}" dy="0.35em" text-anchor="${Math.cos(ang)>0?'start':'end'}" font-size="8">${lbl}</text>`;
    });
    svgHtml += `<path d="${polyD(ptsRec)}" fill="#005B96" fill-opacity="0.3" stroke="#005B96" stroke-width="1"/>`;
    svgHtml += `<path d="${polyD(ptsOecd)}" fill="#F9A825" fill-opacity="0.3" stroke="#F9A825" stroke-width="1"/>`;
    svgHtml += `</g></svg>`;

    tooltip.html(
      `<div class="tooltip-header">
         <span class="flag">${rec.flag}</span>
         <span class="name">${rec.country}</span>
         <span class="pop">${(rec.population/1e6).toFixed(2)}M</span>
       </div>
       <div class="tooltip-metric">
         Life satisfaction: <span style="color:${colorScale(rec['Life satisfaction'])}">${rec['Life satisfaction'].toFixed(1)}</span>
       </div>
       <div class="tooltip-chart">${svgHtml}</div>
       <div class="radar-legend">
         <span class="legend-swatch" style="background:#005B96"></span>${rec.country}
         <span class="legend-swatch" style="background:#F9A825"></span>OECD Avg
       </div>
       <div class="tooltip-categories"><table>
         ${Object.entries(GROUPS).map(([g,cols]) => `
           <tr><th colspan="2">${g}</th></tr>
           ${cols.map(col => {
             const v = rec[col];
             return `<tr><td class="cat-label">${col}</td><td class="cat-value">${isNaN(v)?'—':v.toFixed(1)}</td></tr>`;
           }).join('')}
         `).join('')}
       </table></div>`
    ).classed('hidden',false);
  }

  function moveTooltip(event) {
    tooltip
      .style('left', `${event.pageX+10}px`)
      .style('top',  `${event.pageY+10}px`);
  }

  function updateComparisonWidgets(home, sel) {
    if (!home && sel) {
      homeRec = sel;
      localStorage.setItem('bli-selected-country', sel.country);
      updateComparisonWidgets(homeRec, null);
      return;
    }
    homeRec = home || homeRec;

    const allGroups = Object.keys(GROUPS);
    const half = Math.ceil(allGroups.length/2);
    const left = allGroups.slice(0,half);
    const right = allGroups.slice(half);

    // Home column
    let h = `<div class="widget-header"><span class="flag">${homeRec.flag}</span> ${homeRec.country}</div>`;
    h += `<div class="widget-columns"><div class="col">`;
    left.forEach(g => { h += `<div><span class="widget-label">${g}:</span> ${homeRec.groupAvg[g].toFixed(1)}</div>`; });
    h += `</div><div class="col">`;
    right.forEach(g => { h += `<div><span class="widget-label">${g}:</span> ${homeRec.groupAvg[g].toFixed(1)}</div>`; });
    h += `</div></div>`;
    homeBox.innerHTML = h;

    // Selected column
    if (sel) {
      let s = `<div class="widget-header"><span class="flag">${sel.flag}</span> ${sel.country}</div>`;
      s += `<div class="widget-columns"><div class="col">`;
      left.forEach(g => {
        const diff = sel.groupAvg[g] - homeRec.groupAvg[g];
        const c = diff>0? '#4daf4a': diff<0? '#e41a1c': '#555';
        s += `<div><span class="widget-label">${g}:</span> <span style="color:${c}">${sel.groupAvg[g].toFixed(1)}</span></div>`;
      });
      s += `</div><div class="col">`;
      right.forEach(g => {
        const diff = sel.groupAvg[g] - homeRec.groupAvg[g];
        const c = diff>0? '#4daf4a': diff<0? '#e41a1c': '#555';
        s += `<div><span class="widget-label">${g}:</span> <span style="color:${c}">${sel.groupAvg[g].toFixed(1)}</span></div>`;
      });
      s += `</div></div>`;
      selBox.innerHTML = s;
    } else {
      selBox.innerHTML = '<em>Select a country<br>for comparison</em>';
    }
  }
}