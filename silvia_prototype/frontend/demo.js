

const spanishRegions = [
  {
    id: 1,
    name: "Andalucía",
    coordinates: { x: 35, y: 75 },
    fireRisk: { level: "Alto", score: 85, color: "destructive" },
    treeHealth: { level: "Moderado", score: 65, color: "secondary" },
    soilMoisture: { level: "Bajo", score: 25, color: "outline" },
    temperature: 38,
    humidity: 20,
    windSpeed: 15,
    area: "87,268 km²",
    population: "8.4M",
    insights: [
      "Estrés por sequía detectado en el 45% del área forestal",
      "Contenido de humedad de la vegetación por debajo del umbral crítico",
      "Patrones de viento favorecen propagación rápida de incendios",
      "Se recomienda posicionamiento inmediato de recursos anti-incendios"
    ],
    threats: [
      { type: "Riesgo de Incendio", severity: "Alto", confidence: 92 },
      { type: "Estrés por Sequía", severity: "Alto", confidence: 89 },
      { type: "Degradación del Suelo", severity: "Moderado", confidence: 67 }
    ]
  },
  {
    id: 2,
    name: "Cataluña",
    coordinates: { x: 75, y: 25 },
    fireRisk: { level: "Moderado", score: 55, color: "secondary" },
    treeHealth: { level: "Bueno", score: 78, color: "default" },
    soilMoisture: { level: "Adecuado", score: 68, color: "default" },
    temperature: 26,
    humidity: 55,
    windSpeed: 12,
    area: "32,114 km²",
    population: "7.7M",
    insights: [
      "Salud forestal general dentro de parámetros normales",
      "Lluvias recientes mejoraron los niveles de humedad del suelo",
      "Algunas áreas muestran signos tempranos de estrés estacional",
      "Continuar protocolos de monitoreo estándar"
    ],
    threats: [
      { type: "Estrés Estacional", severity: "Bajo", confidence: 62 },
      { type: "Riesgo de Incendio", severity: "Moderado", confidence: 78 },
      { type: "Plagas Forestales", severity: "Bajo", confidence: 34 }
    ]
  },
  {
    id: 3,
    name: "Galicia",
    coordinates: { x: 15, y: 15 },
    fireRisk: { level: "Bajo", score: 30, color: "default" },
    treeHealth: { level: "Excelente", score: 92, color: "default" },
    soilMoisture: { level: "Alto", score: 85, color: "default" },
    temperature: 18,
    humidity: 78,
    windSpeed: 8,
    area: "29,574 km²",
    population: "2.7M",
    insights: [
      "Condiciones óptimas de crecimiento en toda la región monitoreada",
      "Alta precipitación proporcionando humedad sostenida",
      "Riesgo mínimo de incendio debido a la humedad elevada",
      "Excelentes indicadores de biodiversidad detectados"
    ],
    threats: [
      { type: "Erosión Costera", severity: "Moderado", confidence: 71 },
      { type: "Riesgo de Incendio", severity: "Muy Bajo", confidence: 95 },
      { type: "Enfermedades Fúngicas", severity: "Bajo", confidence: 28 }
    ]
  },
  {
    id: 4,
    name: "Castilla y León",
    coordinates: { x: 45, y: 35 },
    fireRisk: { level: "Moderado", score: 60, color: "secondary" },
    treeHealth: { level: "Bueno", score: 75, color: "default" },
    soilMoisture: { level: "Moderado", score: 55, color: "secondary" },
    temperature: 24,
    humidity: 45,
    windSpeed: 14,
    area: "94,223 km²",
    population: "2.4M",
    insights: [
      "Condiciones forestales estables con variaciones estacionales",
      "Gestión forestal sostenible mostrando resultados positivos",
      "Monitoreo continuo requerido durante meses de verano",
      "Diversidad de ecosistemas en buen estado general"
    ],
    threats: [
      { type: "Riesgo de Incendio", severity: "Moderado", confidence: 75 },
      { type: "Cambio Climático", severity: "Moderado", confidence: 82 },
      { type: "Despoblación Rural", severity: "Alto", confidence: 88 }
    ]
  }
];


const dataLayers = [
  { id:'fire', name:'Riesgo de Incendio', icon:'🔥' },
  { id:'trees', name:'Salud Forestal', icon:'🌲' },
  { id:'soil', name:'Humedad del Suelo', icon:'🌍' }
];
let activeLayers = new Set(['fire']);
let selectedRegion = null; let analyzing=false;

function renderLayerControls() {
  const wrap = document.getElementById('layerControls'); wrap.innerHTML='';
  dataLayers.forEach(l=> {
    const b = document.createElement('button');
    b.className = 'px-3 py-1 rounded-full border border-border ' + (activeLayers.has(l.id)?'bg-primary text-foreground':'bg-card');
    b.textContent = (activeLayers.has(l.id)?'👁️ ':'🚫 ')+l.icon+' '+l.name;
    b.onclick = ()=>{ activeLayers.has(l.id)?activeLayers.delete(l.id):activeLayers.add(l.id); renderLayerControls(); renderMap(); renderLegend(); };
    wrap.appendChild(b);
  });
}

function renderLegend(){
  const c = document.getElementById('legend'); c.innerHTML = '<div class="font-semibold mb-1">Leyenda</div>';
  if(activeLayers.has('fire')) c.innerHTML += '<div>🔥 Riesgo de Incendio</div>';
  if(activeLayers.has('trees')) c.innerHTML += '<div>🌲 Salud Forestal</div>';
  if(activeLayers.has('soil')) c.innerHTML += '<div>🌍 Humedad del Suelo</div>';
}

function circle(x,y,r,fill,stroke){
  const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',r);
  c.setAttribute('fill',fill); c.setAttribute('stroke',stroke); c.setAttribute('stroke-width','0.5');
  return c;
}

function renderMap(){
  const g = document.getElementById('regionDots'); g.innerHTML='';
  spanishRegions.forEach(r=>{
    if(activeLayers.has('fire')) g.appendChild(circle(r.coordinates.x, r.coordinates.y, r.fireRisk.score/10, 'rgba(229,62,62,.30)','rgba(229,62,62,.6)'));
    if(activeLayers.has('trees')) g.appendChild(circle(r.coordinates.x+2, r.coordinates.y+2, r.treeHealth.score/12, 'rgba(56,161,105,.30)','rgba(56,161,105,.6)'));
    if(activeLayers.has('soil')) g.appendChild(circle(r.coordinates.x-2, r.coordinates.y+2, r.soilMoisture.score/12, 'rgba(59,130,246,.30)','rgba(59,130,246,.6)'));
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx',r.coordinates.x); dot.setAttribute('cy',r.coordinates.y);
    dot.setAttribute('r', selectedRegion===r.id?'3.2':'3');
    dot.setAttribute('fill', selectedRegion===r.id?'#0ea5e9':'#64748b');
    dot.setAttribute('stroke','white'); dot.setAttribute('stroke-width','1');
    dot.style.cursor='pointer'; dot.onclick=()=>!analyzing && handleAnalyzeRegion(r.id);
    g.appendChild(dot);

    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x', r.coordinates.x); label.setAttribute('y', r.coordinates.y-6);
    label.setAttribute('text-anchor','middle'); label.setAttribute('font-size','3');
    label.setAttribute('fill','#cbd5e1'); label.textContent = r.name; g.appendChild(label);
  });
}

function handleAnalyzeRegion(id){
  selectedRegion=id; analyzing=true;
  document.getElementById('instructions').classList.add('hidden');
  const panel = document.getElementById('analysisPanel');
  panel.className='mt-4 p-4 border border-border rounded-lg bg-card';
  panel.innerHTML = `
    <div class='font-semibold text-lg flex items-center gap-2'>📊 Análisis IA en Progreso</div>
    <p class='text-sm text-muted-foreground'>Procesando imágenes satelitales y datos ambientales...</p>
    <div class='mt-3'>
      <div class='flex justify-between text-sm'><span>Análisis Espectral</span><span>100%</span></div>
      <div class='w-full h-2 bg-black/30 rounded-full overflow-hidden'><div class='h-2 bg-primary w-full'></div></div>
    </div>
    <div class='mt-3'>
      <div class='flex justify-between text-sm'><span>Salud Vegetal</span><span>85%</span></div>
      <div class='w-full h-2 bg-black/30 rounded-full overflow-hidden'><div class='h-2 bg-primary' style='width:85%'></div></div>
    </div>
    <div class='mt-3'>
      <div class='flex justify-between text-sm'><span>Riesgo de Incendio</span><span>72%</span></div>
      <div class='w-full h-2 bg-black/30 rounded-full overflow-hidden'><div class='h-2 bg-primary' style='width:72%'></div></div>
    </div>`;
  renderMap();
  setTimeout(()=>{ showResults(spanishRegions.find(r=>r.id===id)); analyzing=false; renderMap(); }, 1500);
}

function showResults(region){
  const panel = document.getElementById('analysisPanel');
  panel.innerHTML = `
    <div class='font-semibold text-lg flex items-center gap-2'>🛰️ Análisis Completado — ${region.name}</div>
    <p class='text-sm text-muted-foreground'>Área: ${region.area} · Población: ${region.population}</p>
    <div class='flex gap-2 mt-2' role='tablist'>
      <button data-tab='overview' class='px-3 py-1 rounded-lg border border-border bg-primary'>Resumen</button>
      <button data-tab='detailed' class='px-3 py-1 rounded-lg border border-border'>Análisis Detallado</button>
      <button data-tab='threats' class='px-3 py-1 rounded-lg border border-border'>Amenazas</button>
    </div>
    <div id='tab-overview' class='mt-3'>
      <div class='grid md:grid-cols-3 gap-3'>
        <div class='p-3 rounded-lg border border-border bg-card text-center'><div class='text-3xl'>🔥</div><div class='text-2xl font-bold'>${region.fireRisk.score}%</div><div class='text-xs text-muted-foreground'>Riesgo de Incendio — ${region.fireRisk.level}</div></div>
        <div class='p-3 rounded-lg border border-border bg-card text-center'><div class='text-3xl'>🌲</div><div class='text-2xl font-bold'>${region.treeHealth.score}%</div><div class='text-xs text-muted-foreground'>Salud Forestal — ${region.treeHealth.level}</div></div>
        <div class='p-3 rounded-lg border border-border bg-card text-center'><div class='text-3xl'>🌍</div><div class='text-2xl font-bold'>${region.soilMoisture.score}%</div><div class='text-xs text-muted-foreground'>Humedad del Suelo — ${region.soilMoisture.level}</div></div>
      </div>
      <div class='grid md:grid-cols-3 gap-3 mt-3'>
        <div class='p-3 rounded-lg border border-border bg-card flex items-center gap-3'><div>🌡️</div><div><div class='font-semibold'>${region.temperature}°C</div><div class='text-xs text-muted-foreground'>Temperatura</div></div></div>
        <div class='p-3 rounded-lg border border-border bg-card flex items-center gap-3'><div>💧</div><div><div class='font-semibold'>${region.humidity}%</div><div class='text-xs text-muted-foreground'>Humedad</div></div></div>
        <div class='p-3 rounded-lg border border-border bg-card flex items-center gap-3'><div>💨</div><div><div class='font-semibold'>${region.windSpeed} km/h</div><div class='text-xs text-muted-foreground'>Viento</div></div></div>
      </div>
    </div>
    <div id='tab-detailed' class='mt-3 hidden'>${region.insights.map(i=>`<div class='flex gap-2'>✅ <span>${i}</span></div>`).join('')}</div>
    <div id='tab-threats' class='mt-3 hidden'>${region.threats.map(t=>`<div class='p-3 rounded-lg border border-border bg-card flex items-center justify-between'><div class='flex items-center gap-2'>⚠️ <span class='font-medium'>${t.type}</span></div><span class='text-xs text-muted-foreground'>${t.severity} — ${t.confidence}% confianza</span></div>`).join('')}</div>
    <div class='flex gap-2 mt-3'><button class='px-4 py-2 rounded-lg bg-primary hover:opacity-90'>Descargar Informe</button><button class='px-4 py-2 rounded-lg border border-border' onclick='resetAnalysis()'>Analizar Otra Región</button></div>`;

  panel.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    panel.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('bg-primary'));
    btn.classList.add('bg-primary');
    ['overview','detailed','threats'].forEach(id=>document.getElementById('tab-'+id).classList.add('hidden'));
    document.getElementById('tab-'+btn.dataset.tab).classList.remove('hidden');
  }));
}

function resetAnalysis(){
  selectedRegion=null;
  document.getElementById('analysisPanel').className='mt-4 hidden';
  document.getElementById('instructions').classList.remove('hidden');
  renderMap();
}

function render(){
  renderLayerControls(); renderLegend(); renderMap();
}
document.addEventListener('DOMContentLoaded', render);
