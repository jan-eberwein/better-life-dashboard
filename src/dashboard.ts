// @ts-nocheck
import * as d3 from 'd3';

// 1. Configuration & globals
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

// Scatter-plot globals
let scatterPlotSvg;
let scatterPlotG;
let betterlifeindexDataWide = [];
let scatterPlotMasterCountry = null;
let currentXCategory = 'Job satisfaction';
let currentYCategory = 'Life satisfaction';
let shouldScaleByPopulation = false;

// 2. Load CSV and initialize controls
d3.csv('/2024BetterLife.csv', d3.autoType).then(raw => {
  betterlifeindexDataWide = raw;
  const countries = Array.from(new Set(raw.map(d=>d.Country))).sort();
  const countrySelect = document.getElementById('country-select');
  countrySelect.innerHTML = countries.map(c=>`<option>${c}</option>`).join('');
  countrySelect.value = countries[0];
  scatterPlotMasterCountry = countries[0];

  // Radar data prep
  const rawKeys = Object.keys(raw[0]).filter(k=>'Country'!==k);
  const radarLong = raw.flatMap(row =>
    rawKeys.map(key => ({
      Country: row.Country,
      Indicator: key.trim(),
      Value: +(row[key]||0)
    }))
  );
  const extentByIndicator = new Map();
  for (const ind of selectedIndicatorsRadar) {
    const vals = radarLong.filter(d=>d.Indicator===ind).map(d=>d.Value);
    extentByIndicator.set(ind, [d3.min(vals), d3.max(vals)]);
  }

  // Scatter controls
  const xAxisSelect = document.getElementById('x-axis-select');
  const yAxisSelect = document.getElementById('y-axis-select');
  const popCheckbox = document.getElementById('scale-population-checkbox');
  const numericKeys = Object.keys(raw[0]).filter(k=>k!=='Country'&&k!=='Flag'&&k!=='Population'&&typeof raw[0][k]==='number');
  for (const k of numericKeys) {
    xAxisSelect.add(new Option(k,k));
    yAxisSelect.add(new Option(k,k));
  }
  xAxisSelect.value = currentXCategory;
  yAxisSelect.value = currentYCategory;
  popCheckbox.checked = shouldScaleByPopulation;

  // Render containers
  setupScatter('#scatter-plot-container');
  renderScatter();
  renderRadar('#chart', radarLong, extentByIndicator, countries[0]);

  // Listeners
  xAxisSelect.onchange = ()=>{ currentXCategory=xAxisSelect.value; renderScatter(); };
  yAxisSelect.onchange = ()=>{ currentYCategory=yAxisSelect.value; renderScatter(); };
  popCheckbox.onchange = ()=>{ shouldScaleByPopulation=popCheckbox.checked; renderScatter(); };
  countrySelect.onchange = ()=>{
    renderRadar('#chart', radarLong, extentByIndicator, countrySelect.value);
    scatterPlotMasterCountry = countrySelect.value;
    renderScatter();
  };
});

// 3. Scatter functions
function setupScatter(sel) {
  scatterPlotSvg = d3.select(sel)
    .append('svg')
    .attr('width',800).attr('height',600);
  scatterPlotG = scatterPlotSvg.append('g').attr('transform','translate(60,40)');
}
function renderScatter() {
  if (!betterlifeindexDataWide.length) return;
  const data = betterlifeindexDataWide.filter(d=>typeof d[currentXCategory]==='number'&&typeof d[currentYCategory]==='number');
  const w = +scatterPlotSvg.attr('width')-120, h=+scatterPlotSvg.attr('height')-100;
  const x = d3.scaleLinear().domain(d3.extent(data,d=>d[currentXCategory])).nice().range([0,w]);
  const y = d3.scaleLinear().domain(d3.extent(data,d=>d[currentYCategory])).nice().range([h,0]);
  const rscale = shouldScaleByPopulation
    ? d3.scaleSqrt().domain(d3.extent(data,d=>d.Population)).range([3,20])
    : ()=>5;

  scatterPlotG.selectAll('*').remove();
  scatterPlotG.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x));
  scatterPlotG.append('g').call(d3.axisLeft(y));

  const tip = d3.select('body').selectAll('.scatter-tip').data([0]);
  tip.enter().append('div').attr('class','scatter-tip')
    .style('position','absolute').style('pointer-events','none')
    .style('opacity',0).merge(tip);

  scatterPlotG.selectAll('circle')
    .data(data,d=>d.Country)
    .join('circle')
    .attr('cx',d=>x(d[currentXCategory]))
    .attr('cy',d=>y(d[currentYCategory]))
    .attr('r',d=>rscale(d.Population))
    .attr('fill',d=>d.Country===scatterPlotMasterCountry?'orange':'steelblue')
    .on('mouseover',(e,d)=>{
      d3.select('.scatter-tip')
        .style('opacity',1)
        .html(`${d.Country}<br>${currentXCategory}: ${d[currentXCategory]}<br>${currentYCategory}: ${d[currentYCategory]}<br>Pop: ${d3.format(',')(d.Population)}`)
        .style('left',e.pageX+10+'px')
        .style('top', e.pageY+10+'px');
    })
    .on('mouseout',()=>d3.select('.scatter-tip').style('opacity',0));
}

// 4. Radar functions
function renderRadar(sel,data,extents,country) {
  d3.select(sel).selectAll('*').remove();
  const svg = d3.select(sel).append('svg').attr('width',700).attr('height',600);
  const g = svg.append('g').attr('transform','translate(350,300)');
  const levels=5, angle=2*Math.PI/selectedIndicatorsRadar.length;
  const [w,h]=[700,600];
  const R=Math.min(w/2,h/2)-50;

  // draw grid
  for(let i=1;i<=levels;i++){
    g.append('circle').attr('r',R*i/levels).attr('stroke','#ccc').attr('fill','none');
  }
  // axes & labels
  selectedIndicatorsRadar.forEach((ind,i)=>{
    const a=i*angle-Math.PI/2;
    g.append('line').attr('x1',0).attr('y1',0).attr('x2',R*Math.cos(a)).attr('y2',R*Math.sin(a)).attr('stroke','#999');
    g.append('text')
      .attr('x',(R+20)*Math.cos(a))
      .attr('y',(R+20)*Math.sin(a))
      .attr('text-anchor','middle')
      .text(formatIndicatorRadar(ind));
  });

  // data
  const radarData = selectedIndicatorsRadar.flatMap(ind=>{
    const [lo,hi]=extents.get(ind);
    const scale=d3.scaleLinear().domain([lo,hi]).range([0,R]);
    const val = data.find(d=>d.Country===country&&d.Indicator===ind)?.Value||lo;
    const avg = d3.mean(data.filter(d=>d.Indicator===ind).map(d=>d.Value));
    return [
      {country,indicator:ind,value:scale(val)},
      {'country':'OECD',indicator:ind,value:scale(avg)}
    ];
  });

  const lineGen = d3.lineRadial().radius(d=>d.value).angle((_,i)=>i*angle).curve(d3.curveLinearClosed);
  const grouped = d3.group(radarData,d=>d.country);
  const col = d3.scaleOrdinal().domain([country,'OECD']).range(['#e41a1c','#4daf4a']);

  for(const [c,pts] of grouped){
    const ordered = selectedIndicatorsRadar.map(ind=>pts.find(p=>p.indicator===ind));
    g.append('path').datum(ordered).attr('d',lineGen).attr('fill',col(c)).attr('fill-opacity',0.2).attr('stroke',col(c));
  }
}