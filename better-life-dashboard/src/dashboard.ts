import * as d3 from 'd3';

// 1. Configuration & globals
const selectedIndicators = [
    'Housing expenditure',
    'Rooms per person',
    'Household net adjusted disposable income',
    'Household net wealth',
    'Employment rate',
    'Personal earnings',
    'Quality of support network',
    'Educational attainment',
    'Student skills',
    'Life expectancy',
    'Self-reported health'
];

const formatIndicator = (ind: string) =>
    ({
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

// 2. Load CSV and initialize controls
Promise.all([ d3.csv('/2024BetterLife.csv', d3.autoType) ]).then(([raw]) => {
    // pivot into flat array
    const rawKeys = Object.keys(raw[0]).filter(k => k !== 'Country');
    const vis1 = raw.flatMap(row =>
        rawKeys.map(key => ({
            Country: row.Country as string,
            Indicator: key.trim(),
            Value: +(row as any)[key]
        }))
    );

    // compute min/max per indicator
    const extentByIndicator = new Map<string,[number,number]>();
    for (const ind of selectedIndicators) {
        const vals = vis1.filter(d => d.Indicator===ind).map(d=>d.Value);
        extentByIndicator.set(ind, [d3.min(vals)!, d3.max(vals)!]);
    }

    // dropdown
    const countries = Array.from(new Set(vis1.map(d=>d.Country))).sort();
    const select = document.getElementById('country-select') as HTMLSelectElement;
    select.innerHTML = countries.map(c=>`<option>${c}</option>`).join('');
    select.value = countries[0];

    // initial render + listener
    renderChart(vis1, extentByIndicator, countries[0]);
    select.addEventListener('change', () => renderChart(vis1, extentByIndicator, select.value));
});

// 3. Chart rendering
function renderChart(
    data: { Country:string; Indicator:string; Value:number }[],
    extents: Map<string,[number,number]>,
    selectedCountry: string
) {
    d3.select('#chart').selectAll('*').remove();

    // compute averages
    const oecdAverages = Object.fromEntries(
        selectedIndicators.map(ind => {
            const vals = data.filter(d=>d.Indicator===ind).map(d=>d.Value);
            return [ind, d3.mean(vals)!];
        })
    );

    // build radar data (normalized)
    const radarData = selectedIndicators.flatMap(ind => {
        const [lo,hi] = extents.get(ind)!;
        const scale = d3.scaleLinear([lo,hi],[0,10]);
        const selVal = data.find(d=>d.Country===selectedCountry&&d.Indicator===ind)?.Value ?? lo;
        return [
            { country: selectedCountry, indicator: ind, value: scale(selVal) },
            { country: 'OECD',         indicator: ind, value: scale(oecdAverages[ind]) }
        ];
    });

    // dimensions
    const margin = { top:50,right:100,bottom:50,left:100 };
    const W = 700, H = 600;
    const R = Math.min(W-margin.left-margin.right, H-margin.top-margin.bottom)/2;
    const angle = 2*Math.PI/selectedIndicators.length;
    const levels = 5;

    // svg
    const svg = d3.select('#chart')
        .append('svg')
        .attr('width',W)
        .attr('height',H)
        .attr('viewBox',`0 0 ${W} ${H}`)
        .style('background', 'var(--color-white)')    // ensure white background
        .style('font-family','Raleway, sans-serif');

    const g = svg.append('g')
        .attr('transform',`translate(${W/2},${H/2})`);

    // grid
    for (let i=1;i<=levels;++i) {
        g.append('circle')
            .attr('r', R*i/levels)
            .attr('fill','none')
            .attr('stroke','#ccc');
    }

    // axes + labels
    selectedIndicators.forEach((ind,i) => {
        const a = i*angle - Math.PI/2;
        const x = R*Math.cos(a), y = R*Math.sin(a);
        g.append('line')
            .attr('x1',0).attr('y1',0)
            .attr('x2',x).attr('y2',y)
            .attr('stroke','#999');
        g.append('text')
            .attr('x',(R+20)*Math.cos(a))
            .attr('y',(R+20)*Math.sin(a))
            .attr('dy',a>0?'1em':'0em')
            .attr('text-anchor',Math.abs(Math.cos(a))<0.1?'middle':a>0?'start':'end')
            .style('font-size','12px')
            .text(formatIndicator(ind));
    });

    // scale & line
    const rScale = d3.scaleLinear([0,10],[0,R]);
    const radarLine = d3.lineRadial<any>()
        .radius(d=>rScale(d.value))
        .angle((_,i)=>i*angle)
        .curve(d3.curveLinearClosed);

    const byCountry = d3.group(radarData,d=>d.country);
    const color = d3.scaleOrdinal<string>()
        .domain([selectedCountry,'OECD'])
        .range(['#e41a1c','#4daf4a']);

    // draw
    for (const [country,pts] of byCountry) {
        const ordered = selectedIndicators.map(ind=>pts.find(p=>p.indicator===ind)!);
        g.append('path')
            .datum(ordered)
            .attr('d',radarLine as any)
            .attr('fill',color(country))
            .attr('fill-opacity',0.2)
            .attr('stroke',color(country))
            .attr('stroke-width',2);
        ordered.forEach((d,i) => {
            const a = i*angle - Math.PI/2, r = rScale(d.value);
            g.append('circle')
                .attr('cx',r*Math.cos(a))
                .attr('cy',r*Math.sin(a))
                .attr('r',4)
                .attr('fill',color(country));
        });
    }

    // legend
    const legend = svg.append('g')
        .attr('transform',`translate(${W-margin.right+20},${margin.top})`);
    [selectedCountry,'OECD'].forEach((c,i) => {
        const lg = legend.append('g').attr('transform',`translate(0,${25*i})`);
        lg.append('line')
            .attr('x1',0).attr('y1',10)
            .attr('x2',30).attr('y2',10)
            .attr('stroke',color(c)).attr('stroke-width',2);
        lg.append('circle')
            .attr('cx',15).attr('cy',10).attr('r',4).attr('fill',color(c));
        lg.append('text')
            .attr('x',40).attr('y',10).attr('dy','0.35em')
            .style('font-size','12px')
            .text(c);
    });
}
