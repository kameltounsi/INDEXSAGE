import { FormEvent, useEffect, useMemo, useState } from 'react';

type Dashboard = {
  user: { name: string; department: string; jobTitle: string; username: string; matricule: string; manager: boolean; admin?: boolean };
  applications: { code: string; label: string; hasAccount: boolean; url: string; identifier?: string; role?: string; email?: string }[];
  metrics: { lotsProcessed?: number; attendanceRate?: number | null; attentionPoints?: number; completedActions?: number };
  traceability: { lotsToday?: number; pendingControls?: number; nonConformities?: number; shipmentsReady?: number | null; lastUpdate?: string | null; dailyEvents?: DataRow[]; eventTypes?: DataRow[]; topParts?: DataRow[]; projects?: DataRow[]; dailyQuantities?: DataRow[]; available?: boolean };
  hr: { presenceStatus?: string; leaveBalance?: number | null; pendingRequests?: number; teamAbsences?: number; nextEvent?: string; dailyPresence?: DataRow[]; requestTypes?: DataRow[]; requestStatus?: DataRow[]; attendanceHours?: DataRow[]; available?: boolean };
  planning: { totalActions?: number; openActions?: number; lateActions?: number; completedActions?: number; activeProjects?: number; completionRate?: number | null; status?: DataRow[]; projects?: DataRow[]; deadlines?: DataRow[]; stages?: DataRow[]; criticality?: DataRow[]; available?: boolean };
  priorities: { source: string; level: string; title: string; detail: string; url: string }[];
  recentActivity: { source: string; title: string; time: string }[];
};

type Account = {
  id: number;
  username: string;
  matricule: string;
  fullName: string;
  department: string;
  jobTitle: string;
  workType: string;
  accountStatus: string;
  applications: string[];
};

type DataRow = Record<string, string | number>;
type DashboardView = 'ALL' | 'TRACEABILITY' | 'HR' | 'PLANNING';
type ModuleDefinition = { title: string; description: string; icon: string; group: string };
const BUSINESS_MODULES: Record<Exclude<DashboardView, 'ALL'>, ModuleDefinition[]> = {
  PLANNING: [
    ['Dossiers ECR','Créer, modifier, clôturer, annuler et archiver les demandes industrielles.','ECR','Pilotage'],
    ['Workflow par phases','Faire progresser modification ou nouveau projet avec validations et réouvertures.','WF','Pilotage'],
    ['Actions & validations','Affecter responsables, délais, criticité, preuves, approbations et rejets.','AC','Exécution'],
    ['Règles d’actions','Appliquer les modèles standards par phase, rôle et projet.','RG','Configuration'],
    ['Documents & preuves','Centraliser fichiers, liens, justificatifs et livrables PPAP.','DOC','Exécution'],
    ['Retards & alertes','Détecter les échéances, notifier et produire le rapport hebdomadaire.','AL','Surveillance'],
    ['Projets & référentiels','Administrer clients, produits, pilotes et produits finis.','REF','Configuration'],
    ['Collaboration & audit','Messagerie projet, journal d’opérations, exports PDF et Excel.','AUD','Gouvernance'],
  ].map(([title,description,icon,group])=>({title,description,icon,group})),
  HR: [
    ['Employés & organisation','Gérer employés, départements, postes, lignes, shifts et superviseurs.','EMP','Référentiel'],
    ['Pointage & présence','Importer les pointages, qualifier présence, absence, congé et corrections.','PRS','Opérations'],
    ['Permutations','Envoyer ou recevoir des opérateurs avec contrôle des conflits et expiration.','PER','Opérations'],
    ['Opérateurs disponibles','Piloter l’éligibilité par date, créneau et affectation temporaire.','DIS','Opérations'],
    ['Demandes RH','Traiter documents, services internes et suivi des statuts.','DEM','Services'],
    ['Avances sur salaire','Soumettre, accepter, rejeter et historiser les avances.','AV','Services'],
    ['EDI DELFOR','Valider, convertir et historiser les flux EDI vers CSV.','EDI','Planification'],
    ['IA RH','Prévoir l’absentéisme, analyser les CV et recommander des postes.','AI','Intelligence'],
  ].map(([title,description,icon,group])=>({title,description,icon,group})),
  TRACEABILITY: [
    ['Catalogue technique','Administrer familles, composants, classes, projets, coiffes et versions.','CAT','Référentiel'],
    ['Réception logistique','Créer les lots, contrôler séries et enregistrer les quantités reçues.','REC','Flux'],
    ['Stock temps réel','Rechercher articles et suivre reçu, restant, disponible ou consommé.','STK','Flux'],
    ['Consommation coupe','Contrôler présence et compatibilité ligne-projet avant consommation.','CUT','Production'],
    ['Regroupement STB','Regrouper une consommation multiple sous un identifiant transactionnel.','STB','Production'],
    ['Anomalies & corrections','Déclarer, arbitrer et compenser une consommation sans effacer l’historique.','ANO','Qualité'],
    ['Journal de traçabilité','Auditer réception, consommation, correction et suppression de stock.','LOG','Gouvernance'],
    ['Imports & exports','Importer composants et réceptions, exporter les extractions Excel.','XLS','Données'],
  ].map(([title,description,icon,group])=>({title,description,icon,group})),
};
type OperationalData = {
  generatedAt: string;
  traceability: { connected: boolean; totals: DataRow; dailyEvents: DataRow[]; eventTypes: DataRow[]; projects: DataRow[]; stockByStatus: DataRow[]; topParts: DataRow[]; recentActivity: DataRow[] };
  hr: { connected: boolean; totals: DataRow; dailyPresence: DataRow[]; departments: DataRow[]; shifts: DataRow[]; productionLines: DataRow[]; overtime: DataRow[]; absenceReasons: DataRow[] };
  planning: { connected: boolean; totals: DataRow; status: DataRow[]; stages: DataRow[]; projects?: DataRow[]; clients?: DataRow[]; changeTypes?: DataRow[] };
};
type SweetAlertState = { title: string; text: string; icon: 'error' | 'warning' } | null;

const n = (value: string | number | null | undefined) => Number(value ?? 0);
const fmt = (value: string | number | undefined) => n(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const personalValue = (value: string | number | null | undefined) => value == null ? '—' : value;

function Bars({ rows, value, secondary }: { rows: DataRow[]; value: string; secondary?: string }) {
  const max = Math.max(1, ...rows.map((row) => Math.max(n(row[value]), secondary ? n(row[secondary]) : 0)));
  return <div className="real-bars">
    {rows.map((row, index) => <div className="real-bar-group" key={`${row.label}-${index}`}>
      <div className="real-bar-slot">
        <i style={{ height: `${n(row[value]) / max * 100}%` }} title={`${row.label}: ${row[value]}`} />
        {secondary && <i className="secondary" style={{ height: `${n(row[secondary]) / max * 100}%` }} title={`${row.label}: ${row[secondary]}`} />}
      </div>
      <span>{row.label}</span>
    </div>)}
  </div>;
}

function RankedBars({ rows, value = 'value' }: { rows: DataRow[]; value?: string }) {
  const max = Math.max(1, ...rows.map((row) => n(row[value])));
  return <div className="ranked-bars">{rows.map((row, index) =>
    <div className="ranked-row" key={`${row.label}-${index}`}><span title={String(row.label)}>{row.label}</span><i><b style={{ width: `${n(row[value]) / max * 100}%` }} /></i><strong>{fmt(row[value])}</strong></div>
  )}</div>;
}

function ModuleExplorer({ view, compact = false }: { view: Exclude<DashboardView, 'ALL'>; compact?: boolean }) {
  const labels = { PLANNING:'Gestion des plannings / ECR', HR:'Sage RH', TRACEABILITY:'Traçabilité Store' };
  return <section className={`module-explorer module-${view.toLowerCase()} ${compact?'compact':''}`}>
    <header><div><span>CAPACITÉS MÉTIER</span><h2>{labels[view]}</h2><p>Modules reconstruits à partir des processus réellement implémentés.</p></div><b>{BUSINESS_MODULES[view].length}<small> domaines clés</small></b></header>
    <div className="module-grid">{BUSINESS_MODULES[view].map((module,index)=><article key={module.title}><i>{module.icon}</i><div><small>{module.group} · {String(index+1).padStart(2,'0')}</small><h3>{module.title}</h3><p>{module.description}</p></div><span>→</span></article>)}</div>
  </section>;
}

function CrossApplicationFlow() {
  return <section className="cross-flow"><header><span>PROCESSUS TRANSVERSAL</span><h2>Une chaîne opérationnelle, trois applications</h2><p>Le portail relie les décisions et contrôles qui étaient auparavant dispersés.</p></header><div className="flow-track"><article><i>01</i><b>SAGE 360</b><span>Identité, rôles et accès SSO</span></article><em>→</em><article className="flow-hr"><i>02</i><b>Sage RH</b><span>Présence, shift, ligne et affectation</span></article><em>→</em><article className="flow-trace"><i>03</i><b>Traçabilité</b><span>Contrôle puis consommation du stock</span></article><em>↗</em><article className="flow-plan"><i>04</i><b>Planning ECR</b><span>Projet, actions, preuves et validation</span></article></div></section>;
}

function TrendChart({ series }: { series: { label: string; color: string; values: number[] }[] }) {
  const width = 760, height = 220, pad = 22;
  const count = Math.max(2, ...series.map((item) => item.values.length));
  const max = Math.max(1, ...series.flatMap((item) => item.values));
  const points = (values: number[]) => values.map((value, index) => {
    const x = pad + index * ((width - pad * 2) / (count - 1));
    const y = height - pad - (value / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return <div className="trend-visual"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendances de mes applications autorisées">
    <defs><linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7a8e28" stopOpacity=".2"/><stop offset="1" stopColor="#7a8e28" stopOpacity="0"/></linearGradient></defs>
    {[0,1,2,3,4].map((line) => <line key={line} x1={pad} x2={width-pad} y1={pad+line*(height-pad*2)/4} y2={pad+line*(height-pad*2)/4} className="grid-line" />)}
    {series.map((item) => <g key={item.label}><polyline points={points(item.values)} fill="none" stroke={item.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{item.values.map((value,index) => { const [x,y]=points(item.values).split(' ')[index].split(','); return <circle key={index} cx={x} cy={y} r="4" fill="#fff" stroke={item.color} strokeWidth="3"><title>{item.label}: {value}</title></circle>; })}</g>)}
  </svg><div className="trend-legend">{series.map((item)=><span key={item.label}><i style={{background:item.color}}/>{item.label}</span>)}</div></div>;
}

function AutomaticChartGallery({ dashboard }: { dashboard: Dashboard }) {
  const has=(code:string)=>dashboard.applications.some(app=>app.code===code&&app.hasAccount);
  const trace=(dashboard.traceability.dailyEvents??[]).slice(-10);
  const presence=(dashboard.hr.dailyPresence??[]).slice(-10);
  const planning=dashboard.planning.status??[];
  const palette=['#168477','#74508b','#c6791d','#687b28','#3e73a5','#cb5850'];
  const values=[
    has('TRACEABILITY')&&{label:'Traçabilité',value:n(dashboard.traceability.lotsToday),color:palette[0]},
    has('HR')&&{label:'RH',value:n(dashboard.hr.pendingRequests),color:palette[1]},
    has('PLANNING')&&{label:'Planning',value:n(dashboard.planning.openActions),color:palette[2]},
  ].filter(Boolean) as {label:string;value:number;color:string}[];
  const max=Math.max(1,...values.map(item=>item.value));
  const radarPoints=values.map((item,index)=>{const angle=-Math.PI/2+index*Math.PI*2/Math.max(3,values.length);const radius=15+item.value/max*70;return `${100+Math.cos(angle)*radius},${100+Math.sin(angle)*radius}`}).join(' ');
  const waterfall=values.reduce<{label:string;value:number;start:number;color:string}[]>((all,item)=>{const start=all.reduce((sum,row)=>sum+row.value,0);all.push({...item,start});return all},[]);
  const spark=(rows:DataRow[],key:string)=>{const points=rows.map(row=>n(row[key]));const top=Math.max(1,...points);return points.map((value,index)=>`${index/(Math.max(1,points.length-1))*100},${42-value/top*35}`).join(' ')};
  return <section className="automatic-gallery"><header><div><small>GALERIE ANALYTIQUE</small><h2>Visualisations automatiques</h2><p>Plusieurs lectures complémentaires générées à partir de vos modules autorisés.</p></div><span>{10+(has('HR')?2:0)+(has('TRACEABILITY')?2:0)} graphiques</span></header><div className="gallery-grid">
    <article><ChartTitle tag="RADAR" title="Équilibre opérationnel"/><svg className="radar-chart" viewBox="0 0 200 200"><polygon points="100,18 178,75 148,168 52,168 22,75" className="radar-grid"/><polygon points={radarPoints} className="radar-data"/><circle cx="100" cy="100" r="3"/></svg></article>
    <article><ChartTitle tag="BULLES" title="Poids des domaines"/><div className="bubble-chart">{values.map((item,index)=><i key={item.label} style={{width:55+item.value/max*85,height:55+item.value/max*85,background:item.color,left:`${8+index*28}%`}}><b>{fmt(item.value)}</b><span>{item.label}</span></i>)}</div></article>
    <article><ChartTitle tag="JAUGES" title="Santé par application"/><div className="multi-gauges">{values.map(item=><div key={item.label} style={{'--gauge':`${Math.max(8,100-item.value/max*70)}%`,'--tone':item.color} as React.CSSProperties}><i><b>{Math.round(Math.max(8,100-item.value/max*70))}%</b></i><span>{item.label}</span></div>)}</div></article>
    <article className="gallery-wide"><ChartTitle tag="WATERFALL" title="Contribution à la charge globale"/><div className="waterfall">{waterfall.map(item=><div key={item.label}><i style={{height:`${Math.max(5,item.value/max*100)}%`,marginBottom:`${item.start/(Math.max(1,waterfall.reduce((s,r)=>s+r.value,0)))*35}px`,background:item.color}}/><span>{item.label}</span><b>+{fmt(item.value)}</b></div>)}</div></article>
    {has('TRACEABILITY')&&<article className="gallery-wide"><ChartTitle tag="COURBE DOUBLE" title="Réceptions et consommations"/><TrendChart series={[{label:'Réceptions',color:palette[0],values:trace.map(row=>n(row.receptions))},{label:'Consommations',color:'#65b7aa',values:trace.map(row=>n(row.consumptions))}]}/></article>}
    {has('HR')&&<article className="gallery-wide"><ChartTitle tag="PRÉSENCE" title="Présents et absents"/><Bars rows={presence} value="present" secondary="absent"/></article>}
    <article><ChartTitle tag="SPARKLINES" title="Pouls des applications"/><div className="spark-list">{has('TRACEABILITY')&&<Spark label="Flux" color={palette[0]} points={spark(trace,'receptions')}/>} {has('HR')&&<Spark label="Présences" color={palette[1]} points={spark(presence,'present')}/>} {has('PLANNING')&&<Spark label="Actions" color={palette[2]} points={spark(planning,'value')}/>}</div></article>
    <article><ChartTitle tag="LOLLIPOP" title="Priorités ouvertes"/><div className="lollipop">{values.map(item=><p key={item.label}><span>{item.label}</span><i><em style={{width:`${item.value/max*100}%`,background:item.color}}><b style={{background:item.color}}/></em></i><strong>{fmt(item.value)}</strong></p>)}</div></article>
    <article><ChartTitle tag="POLAR" title="Distribution des alertes"/><div className="polar-chart">{values.map((item,index)=><i key={item.label} style={{transform:`rotate(${index*360/Math.max(1,values.length)}deg)`,height:`${35+item.value/max*60}px`,background:item.color}}/>)}</div></article>
    <article><ChartTitle tag="MATRICE" title="Impact × volume"/><div className="quadrant"><span>Impact élevé</span>{values.map((item,index)=><i key={item.label} style={{left:`${20+index*30}%`,bottom:`${15+item.value/max*65}%`,background:item.color}} title={item.label}>{item.label.slice(0,2)}</i>)}<b>Volume →</b></div></article>
    <article className="gallery-wide"><ChartTitle tag="BARRES HORIZONTALES" title="Répartition des actions planning"/><RankedBars rows={planning.length?planning:values}/></article>
    <article><ChartTitle tag="DONUTS" title="Progression consolidée"/><div className="mini-donuts">{values.map(item=><div key={item.label} style={{background:`conic-gradient(${item.color} ${Math.max(5,100-item.value/max*70)}%,#e9ede4 0)`}}><i><b>{fmt(item.value)}</b></i><span>{item.label}</span></div>)}</div></article>
  </div></section>;
}

function ChartTitle({tag,title}:{tag:string;title:string}){return <header className="gallery-title"><div><small>{tag}</small><h3>{title}</h3></div><span>● LIVE</span></header>}
function Spark({label,color,points}:{label:string;color:string;points:string}){return <div><span>{label}</span><svg viewBox="0 0 100 45" preserveAspectRatio="none"><polyline points={points} style={{stroke:color}}/></svg></div>}

function UnifiedTopKpis({dashboard}:{dashboard:Dashboard}){
  const has=(code:string)=>dashboard.applications.some(app=>app.code===code&&app.hasAccount);
  const risks=[has('TRACEABILITY')&&{label:'Traçabilité',value:n(dashboard.traceability.pendingControls)+n(dashboard.traceability.nonConformities)},has('HR')&&{label:'Ressources humaines',value:n(dashboard.hr.pendingRequests)+n(dashboard.hr.teamAbsences)},has('PLANNING')&&{label:'Planning ECR',value:n(dashboard.planning.lateActions)}].filter(Boolean) as {label:string;value:number}[];
  const riskCount=risks.reduce((sum,item)=>sum+item.value,0);
  const focus=risks.reduce((best,item)=>item.value>best.value?item:best,risks[0]);
  return <section className="visual-kpis top-kpis">
    {has('TRACEABILITY')&&<article className="trace-kpi"><div><span>TR</span><small>FLUX TRAÇABILITÉ</small></div><b>{fmt(dashboard.traceability.lotsToday)}</b><p>actions aujourd’hui</p><em>{n(dashboard.traceability.pendingControls)} à contrôler</em></article>}
    {has('HR')&&<article className="hr-kpi"><div><span>RH</span><small>PRÉSENCE</small></div><b>{dashboard.hr.presenceStatus||'—'}</b><p>statut du jour</p><em>{n(dashboard.hr.pendingRequests)} demande(s) ouverte(s)</em></article>}
    {has('PLANNING')&&<article className="planning-kpi"><div><span>PL</span><small>AVANCEMENT ECR</small></div><b>{Math.round(n(dashboard.planning.completionRate))}%</b><p>actions réalisées</p><em>{n(dashboard.planning.lateActions)} en retard</em></article>}
    <article className="focus-kpi"><div><span>{riskCount>0?'!':'✓'}</span><small>{riskCount>0?'ZONE PRIORITAIRE':'SITUATION'}</small></div><b>{riskCount>0?focus?.label:'Sous contrôle'}</b><p>{riskCount} point(s) d’attention</p><em>{riskCount>0?'Priorité recommandée':'Aucune urgence détectée'}</em></article>
  </section>;
}

function UnifiedVisualDashboard({ dashboard }: { dashboard: Dashboard }) {
  type DashboardPeriod = 7 | 14 | 30 | 90;
  type DashboardWidget = 'trends' | 'risks' | 'progress' | 'activity';
  const [period, setPeriod] = useState<DashboardPeriod>(() => (Number(localStorage.getItem('sage-dashboard-period')) as DashboardPeriod) || 14);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlRoom,setControlRoom] = useState(false);
  const [privacyMode,setPrivacyMode] = useState(false);
  const [comparisonMode,setComparisonMode] = useState<'week'|'month'>('week');
  const [widgets, setWidgets] = useState<Record<DashboardWidget, boolean>>(() => {
    try { return { trends:true, risks:true, progress:true, activity:true, ...JSON.parse(localStorage.getItem('sage-dashboard-widgets') || '{}') }; }
    catch { return { trends:true, risks:true, progress:true, activity:true }; }
  });
  useEffect(() => localStorage.setItem('sage-dashboard-period', String(period)), [period]);
  useEffect(() => localStorage.setItem('sage-dashboard-widgets', JSON.stringify(widgets)), [widgets]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setControlRoom(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
  const has = (code: string) => dashboard.applications.some(app => app.code === code && app.hasAccount);
  const traceTrend=(dashboard.traceability.dailyEvents ?? []).slice(-period).map(row=>n(row.receptions)+n(row.consumptions));
  const hrTrend=(dashboard.hr.dailyPresence ?? []).slice(-period).map(row=>n(row.absent));
  const planningTrend=(dashboard.planning.status ?? []).slice(0,Math.min(period,12)).map(row=>n(row.value));
  const risks=[
    {label:'Traçabilité',value:n(dashboard.traceability.pendingControls)+n(dashboard.traceability.nonConformities),color:'#147d70'},
    {label:'Ressources humaines',value:n(dashboard.hr.pendingRequests)+n(dashboard.hr.teamAbsences),color:'#74508b'},
    {label:'Planning ECR',value:n(dashboard.planning.lateActions),color:'#d17b24'},
  ].filter((_, index) => [has('TRACEABILITY'), has('HR'), has('PLANNING')][index]);
  const total=Math.max(1,risks.reduce((sum,item)=>sum+item.value,0));
  const riskCount=risks.reduce((sum,item)=>sum+item.value,0);
  let cursor=0;
  const gradient=risks.map((item)=>{const start=cursor;cursor+=item.value/total*100;return `${item.color} ${start}% ${cursor}%`;}).join(',');
  const focus=risks.reduce((best,item)=>item.value>best.value?item:best,risks[0]);
  const trends = [
    has('TRACEABILITY') && {label:'Flux traçabilité',color:'#147d70',values:traceTrend.length?traceTrend:[0]},
    has('HR') && {label:'Absences RH',color:'#74508b',values:hrTrend.length?hrTrend:[0]},
    has('PLANNING') && {label:'Charge planning',color:'#d17b24',values:planningTrend.length?planningTrend:[0]},
  ].filter(Boolean) as { label: string; color: string; values: number[] }[];
  const progress = [
    has('PLANNING') && {label:'Workflow ECR',value:n(dashboard.planning.completionRate),color:'#d17b24'},
    has('HR') && {label:'Présence 30 jours',value:n(dashboard.metrics.attendanceRate),color:'#74508b'},
    has('TRACEABILITY') && {label:'Traitement des alertes',value:Math.max(0,100-Math.min(100,total*10)),color:'#147d70'},
  ].filter(Boolean) as { label: string; value: number; color: string }[];
  const toggleWidget = (widget: DashboardWidget) => setWidgets(current => ({...current, [widget]:!current[widget]}));
  const healthScore=Math.max(0,Math.round(progress.length?progress.reduce((sum,item)=>sum+Math.max(0,Math.min(100,item.value)),0)/progress.length-riskCount*2:100-riskCount*5));
  const healthLabel=healthScore>=80?'Situation stable':healthScore>=60?'Attention nécessaire':'Risque opérationnel';
  const heatValues=Array.from({length:28},(_,index)=>{const series=[...traceTrend,...hrTrend,...planningTrend];return series.length?series[index%series.length]:0});
  const heatMax=Math.max(1,...heatValues);
  const calendarItems=[...dashboard.priorities.slice(0,4).map((item,index)=>({day:index+1,label:item.title,source:item.source})),...(has('HR')&&dashboard.hr.nextEvent?[{day:5,label:dashboard.hr.nextEvent,source:'RH'}]:[])];
  const comparison=[
    has('TRACEABILITY')&&{label:'Flux',current:traceTrend.slice(-7).reduce((a,b)=>a+b,0),previous:traceTrend.slice(-14,-7).reduce((a,b)=>a+b,0),color:'#168477'},
    has('HR')&&{label:'Absences',current:hrTrend.slice(-7).reduce((a,b)=>a+b,0),previous:hrTrend.slice(-14,-7).reduce((a,b)=>a+b,0),color:'#74508b'},
    has('PLANNING')&&{label:'Charge ECR',current:n(dashboard.planning.openActions),previous:n(dashboard.planning.openActions)+n(dashboard.planning.completedActions),color:'#c6791d'},
  ].filter(Boolean) as {label:string;current:number;previous:number;color:string}[];
  const forecast=[has('TRACEABILITY')&&{label:'Flux estimé à 7 jours',value:Math.round((traceTrend.reduce((a,b)=>a+b,0)/Math.max(1,traceTrend.length))*7),tone:'trace'},has('HR')&&{label:'Absences probables',value:Math.round(hrTrend.reduce((a,b)=>a+b,0)/Math.max(1,hrTrend.length)),tone:'hr'},has('PLANNING')&&{label:'Actions à risque',value:n(dashboard.planning.lateActions)+Math.round(n(dashboard.planning.openActions)*.12),tone:'planning'}].filter(Boolean) as {label:string;value:number;tone:string}[];
  const nextAction=riskCount>0?`Traiter en priorité : ${focus.label}`:'Consulter les prochaines échéances et préparer la journée suivante';
  const story=`${healthLabel}. ${has('HR')?`Présence ${dashboard.hr.presenceStatus||'non renseignée'}, `:''}${has('TRACEABILITY')?`${fmt(dashboard.traceability.lotsToday)} action(s) de traçabilité aujourd’hui, `:''}${has('PLANNING')?`${fmt(dashboard.planning.lateActions)} action(s) ECR en retard. `:''}${riskCount} point(s) d’attention au total.`;
  const exportSnapshot=()=>{const content=`SAGE Index — ${new Date().toLocaleString('fr-FR')}\nScore: ${healthScore}/100\n${story}`;const blob=new Blob([content],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='sage-index-synthese.txt';anchor.click();URL.revokeObjectURL(url)};
  return <section className={`unified-visual-dashboard ${controlRoom?'control-room':''} ${privacyMode?'privacy-mode':''}`}>
    <div className="visual-dashboard-head"><div><p className="eyebrow">COCKPIT PERSONNALISÉ</p><h2>Ma situation opérationnelle en temps réel</h2><p>Une lecture graphique limitée aux applications associées à votre compte.</p></div><div className="dashboard-head-actions"><div className="live-indicator"><i/> Données synchronisées</div><div><button className="customize-dashboard" onClick={()=>setPrivacyMode(value=>!value)}>{privacyMode?'◉ Afficher':'◌ Confidentialité'}</button><button className="customize-dashboard" onClick={exportSnapshot}>⇩ Exporter</button><button className="customize-dashboard" onClick={()=>setControlRoom(value=>!value)}>{controlRoom?'✕ Quitter':'▣ Salle de contrôle'}</button><button className="customize-dashboard" onClick={()=>setSettingsOpen(value=>!value)}>⚙ Personnaliser</button></div></div></div>
    <div className="dashboard-controls"><div><small>PÉRIODE D’ANALYSE</small><div className="period-picker">{([7,14,30,90] as DashboardPeriod[]).map(value=><button key={value} className={period===value?'active':''} onClick={()=>setPeriod(value)}>{value} jours</button>)}</div></div><span>Les tendances et comparaisons s’adaptent automatiquement à la période choisie.</span></div>
    {settingsOpen && <div className="dashboard-customizer"><div><b>Composer mon dashboard</b><span>Votre sélection est mémorisée sur cet appareil.</span></div>{([['trends','Tendances'],['risks','Risques'],['progress','Performance'],['activity','Activité récente']] as [DashboardWidget,string][]).map(([key,label])=><label key={key}><input type="checkbox" checked={widgets[key]} onChange={()=>toggleWidget(key)}/><i/><span>{label}</span></label>)}</div>}
    <div className="intelligence-grid">
      <article className="health-card"><div className="health-ring" style={{'--health':`${healthScore}%`} as React.CSSProperties}><div><b>{healthScore}</b><span>/100</span></div></div><section><small>SCORE DE SANTÉ</small><h3>{healthLabel}</h3><p>{riskCount?`${riskCount} point(s) demandent votre attention.`:'Aucune anomalie critique détectée.'}</p></section></article>
      <article className="heatmap-card"><header><div><small>CARTE THERMIQUE</small><h3>Intensité d’activité</h3></div><span>{period} jours</span></header><div className="activity-heatmap">{heatValues.map((value,index)=><i key={index} style={{opacity:.16+value/heatMax*.84}} title={`Point ${index+1} : ${fmt(value)}`}/>)}</div><footer><span>Faible</span><i/><i/><i/><span>Forte</span></footer></article>
      <article className="smart-calendar"><header><div><small>CALENDRIER INTELLIGENT</small><h3>Prochains points clés</h3></div><b>{calendarItems.length}</b></header><div>{calendarItems.map((item,index)=><p key={index}><time>{String(item.day).padStart(2,'0')}</time><span><small>{item.source}</small><b>{item.label}</b></span></p>)}{calendarItems.length===0&&<em>Aucun événement planifié.</em>}</div></article>
    </div>
    <article className="unified-timeline"><header><div><small>TIMELINE UNIFIÉE</small><h3>Le fil de votre activité autorisée</h3></div><span>Derniers événements</span></header><div>{dashboard.recentActivity.slice(0,8).map((activity,index)=><section key={`${activity.source}-${index}`}><i className={activity.source==='RH'?'hr':activity.source==='Plannings'?'planning':'trace'}/><time>{activity.time}</time><span><small>{activity.source}</small><b>{activity.title}</b></span></section>)}{dashboard.recentActivity.length===0&&<p>Aucune activité récente.</p>}</div></article>
    <div className="insight-grid">
      <article className="story-card"><small>SYNTHÈSE DU JOUR</small><h3>L’essentiel en une phrase</h3><p>{story}</p><footer><b>Prochaine meilleure action</b><span>{nextAction}</span></footer></article>
      <article className="comparison-card"><header><div><small>AVANT / APRÈS</small><h3>Évolution des indicateurs</h3></div><select value={comparisonMode} onChange={event=>setComparisonMode(event.target.value as 'week'|'month')}><option value="week">Cette semaine</option><option value="month">Ce mois</option></select></header>{comparison.map(item=>{const delta=item.previous?Math.round((item.current-item.previous)/item.previous*100):item.current?100:0;return <div key={item.label}><span>{item.label}</span><i><em style={{width:`${Math.min(100,Math.max(4,item.current/Math.max(1,item.current,item.previous)*100))}%`,background:item.color}}/></i><b className={delta<0?'down':'up'}>{delta>=0?'+':''}{delta}%</b></div>})}</article>
    </div>
    <div className="advanced-grid">
      <article className="relation-map"><header><small>CARTE DES RELATIONS MÉTIER</small><h3>Chaîne opérationnelle</h3></header><div><span className="identity-node">Identité</span>{has('HR')&&<><i>→</i><span className="hr-node">Employé · Shift · Ligne</span></>}{has('TRACEABILITY')&&<><i>→</i><span className="trace-node">Projet · Composant · Lot</span></>}{has('PLANNING')&&<><i>→</i><span className="planning-node">ECR · Action · Validation</span></>}</div></article>
      <article className="forecast-card"><header><small>PRÉVISIONS SIMPLES</small><h3>Projection à court terme</h3></header><div>{forecast.map(item=><p key={item.label} className={item.tone}><span>{item.label}</span><b>{fmt(item.value)}</b></p>)}</div><em>Projection indicative calculée à partir des tendances visibles.</em></article>
    </div>
    <article className="anomaly-wall"><header><div><small>MUR DES ANOMALIES</small><h3>Risques classés par impact</h3></div><span>{riskCount} signalement(s)</span></header><div>{dashboard.priorities.slice().sort((a,b)=>(a.level==='urgent'?0:1)-(b.level==='urgent'?0:1)).slice(0,8).map((item,index)=><a href={item.url} key={`${item.title}-${index}`} className={item.level}><small>{item.source}</small><b>{item.title}</b><span>{item.detail}</span><i>{item.level==='urgent'?'Critique':'À surveiller'}</i></a>)}{dashboard.priorities.length===0&&<p>✓ Aucun signalement actif.</p>}</div></article>
    <article className="sankey-card"><header><small>FLUX INTER-APPLICATIONS</small><h3>De la ressource à l’exécution</h3></header><svg viewBox="0 0 900 180" role="img" aria-label="Flux entre applications autorisées"><defs><linearGradient id="flowA"><stop stopColor="#74508b"/><stop offset="1" stopColor="#168477"/></linearGradient><linearGradient id="flowB"><stop stopColor="#168477"/><stop offset="1" stopColor="#c6791d"/></linearGradient></defs>{has('HR')&&has('TRACEABILITY')&&<path d="M180 70 C330 70 300 115 455 115" stroke="url(#flowA)" strokeWidth="28" opacity=".28" fill="none"/>}{has('TRACEABILITY')&&has('PLANNING')&&<path d="M455 115 C610 115 580 70 730 70" stroke="url(#flowB)" strokeWidth="22" opacity=".28" fill="none"/>}<g><rect x="35" y="45" width="145" height="52" rx="14" fill="#74508b"/><text x="107" y="76" textAnchor="middle">Ressources RH</text><rect x="380" y="90" width="150" height="52" rx="14" fill="#168477"/><text x="455" y="121" textAnchor="middle">Flux & lots</text><rect x="730" y="45" width="140" height="52" rx="14" fill="#c6791d"/><text x="800" y="76" textAnchor="middle">Actions ECR</text></g></svg></article>
    <AutomaticChartGallery dashboard={dashboard}/>
    <div className="visual-grid">
      {widgets.trends && <article className="visual-panel trend-panel"><header><div><small>TENDANCES · {period} JOURS</small><h3>Mon activité</h3></div><span className="visual-chip">PÉRIODE ACTIVE</span></header><TrendChart series={trends} /></article>}
      {widgets.risks && <article className="visual-panel risk-panel"><header><div><small>RÉPARTITION</small><h3>Points d’attention</h3></div></header><div className="risk-content"><div className="risk-donut" style={{background:riskCount > 0 ? `conic-gradient(${gradient})` : '#e7eadf'}}><div><b>{riskCount}</b><span>au total</span></div></div><div className="risk-list">{risks.map(item=><div key={item.label}><i style={{background:item.color}}/><span>{item.label}</span><b>{item.value}</b></div>)}</div></div></article>}
      {widgets.progress && <article className="visual-panel progress-panel"><header><div><small>PERFORMANCE</small><h3>Progression par domaine</h3></div></header>{progress.map(item=><div className="progress-line" key={item.label}><span>{item.label}<b>{Math.round(item.value)}%</b></span><i><em style={{width:`${Math.max(0,Math.min(100,item.value))}%`,background:item.color}}/></i></div>)}</article>}
      {widgets.activity && <article className="visual-panel pulse-panel"><header><div><small>ACTIVITÉ RÉCENTE</small><h3>Flux inter-applications</h3></div></header><div className="pulse-list">{dashboard.recentActivity.slice(0,Math.min(10,Math.max(5,Math.round(period/7)*2))).map((activity,index)=><div key={`${activity.source}-${index}`}><span className={activity.source==='RH'?'hr':activity.source==='Plannings'?'planning':'trace'}>{activity.source==='RH'?'RH':activity.source==='Plannings'?'PL':'TR'}</span><p><b>{activity.title}</b><small>{activity.time}</small></p></div>)}{dashboard.recentActivity.length===0&&<p className="empty-pulse">Aucune activité récente.</p>}</div></article>}
    </div>
  </section>;
}

function CombinedDashboard({ dashboard }: { dashboard: Dashboard }) {
  const modules = [
    { code:'trace', label:'Traçabilité', color:'#168477', headline:personalValue(dashboard.traceability.lotsToday), unit:'actions aujourd\'hui', attention:n(dashboard.traceability.pendingControls)+n(dashboard.traceability.nonConformities), detail:`${personalValue(dashboard.traceability.shipmentsReady)} expéditions prêtes` },
    { code:'hr', label:'Ressources humaines', color:'#7a4d8f', headline:dashboard.hr.presenceStatus || '—', unit:'statut du jour', attention:n(dashboard.hr.pendingRequests)+n(dashboard.hr.teamAbsences), detail:`${personalValue(dashboard.hr.leaveBalance)} jours de congé` },
    { code:'planning', label:'Gestion des plannings', color:'#c6791d', headline:`${Math.max(0,Math.min(100,n(dashboard.planning?.completionRate)))}%`, unit:'avancement ECR', attention:n(dashboard.planning?.lateActions), detail:`${personalValue(dashboard.planning?.openActions)} actions ouvertes` },
  ];
  const maxAttention=Math.max(1,...modules.map((item)=>item.attention));
  return <section className="combined-dashboard"><div className="combined-head"><div><p className="eyebrow">SYNTHÈSE PERSONNALISÉE</p><h2>Mes trois applications en un coup d'œil</h2><span>Indicateurs consolidés pour {dashboard.user.name}</span></div><b>{modules.reduce((sum,item)=>sum+item.attention,0)}<small> points d'attention</small></b></div><div className="combined-modules">{modules.map((item)=><article key={item.code} style={{'--module':item.color} as React.CSSProperties}><header><i/><span>{item.label}</span></header><strong>{item.headline}</strong><small>{item.unit}</small><div><i style={{width:`${Math.max(5,item.attention/maxAttention*100)}%`}}/></div><footer><span>{item.detail}</span><b>{item.attention} à traiter</b></footer></article>)}</div></section>;
}

function PersonalizedAnalytics({ dashboard }: { dashboard: Dashboard }) {
  const has = (code: string) => dashboard.applications.some(app => app.code === code && app.hasAccount);
  const workload = [
    { label: 'Traçabilité', value: n(dashboard.traceability.pendingControls) },
    { label: 'RH', value: n(dashboard.hr.pendingRequests) },
    { label: 'Planning', value: n(dashboard.planning.openActions) },
  ].filter((_, index) => [has('TRACEABILITY'), has('HR'), has('PLANNING')][index]);
  const completed = [
    { label: 'Traçabilité', value: n(dashboard.metrics.lotsProcessed) },
    { label: 'RH', value: (dashboard.hr.requestStatus ?? []).filter(row => ['APPROVED','VALIDATED'].includes(String(row.label).toUpperCase())).reduce((sum,row) => sum+n(row.value),0) },
    { label: 'Planning', value: n(dashboard.planning.completedActions) },
  ].filter((_, index) => [has('TRACEABILITY'), has('HR'), has('PLANNING')][index]);
  return <section className="analytics personal-analytics"><div className="chart-grid">
    {has('TRACEABILITY') && <article className="chart-card wide"><header><div><small>ACTIVITÉ PERSONNELLE</small><h2>Mes opérations sur 14 jours</h2></div><span className="chart-legend">■ Réceptions <span>■ Consommations</span></span></header><Bars rows={dashboard.traceability.dailyEvents ?? []} value="receptions" secondary="consumptions" /></article>}
    <article className="chart-card"><header><div><small>CHARGE CROISÉE</small><h2>Éléments ouverts</h2></div></header><RankedBars rows={workload} /></article>
    <article className="chart-card"><header><div><small>RÉALISATIONS</small><h2>Activité finalisée</h2></div></header><RankedBars rows={completed} /></article>
    {has('HR') && <article className="chart-card wide"><header><div><small>PRÉSENCE PERSONNELLE</small><h2>Mes heures sur 14 jours</h2></div></header><Bars rows={dashboard.hr.attendanceHours ?? []} value="value" /></article>}
    {has('PLANNING') && <article className="chart-card"><header><div><small>PLANNING ECR</small><h2>Mes actions par statut</h2></div></header><RankedBars rows={dashboard.planning.status ?? []} /></article>}
  </div></section>;
}

function ApplicationDashboard({ view, dashboard, operational }: { view: Exclude<DashboardView, 'ALL'>; dashboard: Dashboard; operational: OperationalData | null }) {
  const planningProgress = Math.max(0, Math.min(100, n(dashboard.planning?.completionRate)));
  if (view === 'PLANNING') {
    const stages = dashboard.planning.status?.length ? dashboard.planning.status : operational?.planning.status ?? [
      { label: 'Actions ouvertes', value: n(dashboard.planning.openActions) }, { label: 'En retard', value: n(dashboard.planning.lateActions) }, { label: 'Finalisées', value: n(dashboard.planning.completedActions) }, { label: 'Projets actifs', value: n(dashboard.planning.activeProjects) },
    ];
    const projects = dashboard.planning.projects?.length ? dashboard.planning.projects : operational?.planning.stages ?? [];
    const deadlines = dashboard.planning.deadlines ?? [];
    const pt=operational?.planning.totals ?? {};
    const sourceProjects=dashboard.planning.projects?.length?dashboard.planning.projects:operational?.planning.projects??[];
    return <section className="source-dashboard planning-source source-copy">
      <div className="source-intro"><div><span>DASHBOARD DIRECTION ECR · COPIE PORTAIL</span><h2>Pilotage des modifications, priorités et charges projet</h2><p>Mêmes familles d’indicateurs que l’application Planning : portefeuille, actions, phases, impacts et progression.</p></div><div className="source-score"><b>{planningProgress || fmt(pt.completedactions)}%</b><small>santé du portefeuille</small></div></div>
      <div className="source-kpis"><article><small>DOSSIERS ACTIFS</small><b>{personalValue(dashboard.planning.activeProjects ?? pt.activerequests)}</b><span>Modifications en cours</span></article><article><small>DOSSIERS CLÔTURÉS</small><b>{fmt(pt.closedrequests)}</b><span>Cycle terminé</span></article><article className="warn"><small>ACTIONS EN RETARD</small><b>{personalValue(dashboard.planning.lateActions ?? pt.lateactions)}</b><span>Priorité immédiate</span></article><article><small>ACTIONS TERMINÉES</small><b>{personalValue(dashboard.planning.completedActions ?? pt.completedactions)}</b><span>Validation acquise</span></article></div>
      <div className="source-charts"><article className="source-panel wide"><header><div><small>WORKFLOW ECR</small><h3>Actions par statut</h3></div><em>Temps réel</em></header><RankedBars rows={stages} /></article><article className="source-panel"><header><div><small>SANTÉ PORTEFEUILLE</small><h3>Avancement global</h3></div></header><div className="source-donut" style={{'--fill':`${planningProgress}%`} as React.CSSProperties}><b>{planningProgress}%</b><span>réalisé</span></div></article><article className="source-panel wide"><header><div><small>CHARGE PAR PROJET</small><h3>Portefeuille projets</h3></div></header><RankedBars rows={sourceProjects} /></article><article className="source-panel"><header><div><small>RÉPARTITION PAR PHASE</small><h3>Étapes du workflow</h3></div></header><RankedBars rows={dashboard.planning.stages?.length?dashboard.planning.stages:operational?.planning.stages??[]} /></article><article className="source-panel"><header><div><small>NATURE DES MODIFICATIONS</small><h3>Types de changement</h3></div></header><RankedBars rows={operational?.planning.changeTypes??[]} /></article><article className="source-panel"><header><div><small>CLIENTS IMPACTÉS</small><h3>Distribution dossiers</h3></div></header><RankedBars rows={operational?.planning.clients??[]} /></article><article className="source-panel"><header><div><small>CRITICITÉ</small><h3>Niveau des actions</h3></div></header><RankedBars rows={dashboard.planning.criticality ?? []} /></article><article className="source-panel wide"><header><div><small>PRIORITÉS</small><h3>Actions déjà en retard ou proches</h3></div></header><div className="source-list">{deadlines.map((row, index)=><p key={`${row.label}-${index}`}><i className={n(row.days)<0?'red':n(row.days)<=3?'amber':'green'}/><span>{row.label}</span><b>{row.deadline}</b></p>)}{deadlines.length===0&&<p>Aucune échéance active.</p>}</div></article></div>
    </section>;
  }
  if (view === 'HR') {
    const daily = dashboard.hr.dailyPresence?.length ? dashboard.hr.dailyPresence : operational?.hr.dailyPresence ?? [];
    const requests = dashboard.hr.requestTypes ?? [];
    const ht=operational?.hr.totals??{}; const active=n(ht.employees); const present=n(ht.presenttoday); const rate=active?Math.round(present/active*100):n(dashboard.metrics.attendanceRate);
    return <section className="source-dashboard hr-source source-copy">
      <div className="source-intro"><div><span>DASHBOARD ADMINISTRATIF RH · COPIE PORTAIL</span><h2>Vue d’ensemble des effectifs et de la présence</h2><p>Reprise des KPI, courbes, répartitions et alertes du dashboard Sage RH.</p></div><div className="source-score"><b>{rate}%</b><small>taux de présence</small></div></div>
      <div className="source-kpis"><article><small>EMPLOYÉS ACTIFS</small><b>{active||'—'}</b><span>Effectif actuel</span></article><article><small>PRÉSENTS AUJOURD’HUI</small><b>{present||personalValue(dashboard.hr.presenceStatus)}</b><span>Pointages validés</span></article><article className="warn"><small>ABSENTS AUJOURD’HUI</small><b>{fmt(ht.absenttoday)}</b><span>À analyser</span></article><article><small>TAUX DE PRÉSENCE</small><b>{rate}%</b><span>Situation du jour</span></article></div>
      <div className="source-charts"><article className="source-panel wide"><header><div><small>PRÉSENCE</small><h3>Évolution présence / absence</h3></div><span className="source-legend">■ Présent <i>■ Absent</i></span></header><Bars rows={daily} value="present" secondary="absent" /></article><article className="source-panel"><header><div><small>ORGANISATION</small><h3>Effectif par département</h3></div></header><RankedBars rows={operational?.hr.departments??[]} value="total" /></article><article className="source-panel"><header><div><small>SHIFTS</small><h3>Répartition des équipes</h3></div></header><RankedBars rows={operational?.hr.shifts??[]} /></article><article className="source-panel"><header><div><small>LIGNES DE PRODUCTION</small><h3>Affectations opérationnelles</h3></div></header><RankedBars rows={operational?.hr.productionLines??[]} /></article><article className="source-panel wide"><header><div><small>HEURES SUPPLÉMENTAIRES</small><h3>Évolution quotidienne</h3></div></header><Bars rows={operational?.hr.overtime??dashboard.hr.attendanceHours??[]} value="value" /></article><article className="source-panel"><header><div><small>MOTIFS D’ABSENCE</small><h3>30 derniers jours</h3></div></header><RankedBars rows={operational?.hr.absenceReasons??[]} /></article><article className="source-panel"><header><div><small>DEMANDES RH</small><h3>Par type</h3></div></header><RankedBars rows={requests} /></article><article className="source-panel"><header><div><small>ALERTES & WORKFLOW</small><h3>Demandes par statut</h3></div></header><RankedBars rows={dashboard.hr.requestStatus ?? []} /></article></div>
    </section>;
  }
  const events = dashboard.traceability.dailyEvents?.length ? dashboard.traceability.dailyEvents : operational?.traceability.dailyEvents ?? [];
  const eventTypes = dashboard.traceability.eventTypes?.length ? dashboard.traceability.eventTypes : operational?.traceability.eventTypes ?? [];
  const parts = dashboard.traceability.topParts?.length ? dashboard.traceability.topParts : operational?.traceability.topParts ?? [];
  const stockFill=operational ? n(operational.traceability.totals.remainingquantity)/Math.max(1,n(operational.traceability.totals.receivedquantity))*100 : 0;
  return <section className="source-dashboard trace-source source-copy">
    <div className="source-intro"><div><span>DASHBOARD TRAÇABILITÉ STORE · COPIE PORTAIL</span><h2>Supervision stock, flux et conformité</h2><p>Reprise de la vue par rôle : activité récente, composants, consommations et points d’attention.</p></div><div className="source-score"><b>{Math.round(stockFill)}%</b><small>stock disponible</small></div></div>
    <div className="source-kpis"><article><small>LOTS ACTIFS</small><b>{operational ? fmt(operational.traceability.totals.batches) : personalValue(dashboard.traceability.lotsToday)}</b><span>En base</span></article><article><small>ACTIONS AUJOURD'HUI</small><b>{personalValue(dashboard.traceability.lotsToday)}</b><span>Flux enregistrés</span></article><article className="warn"><small>SIGNALEMENTS OUVERTS</small><b>{personalValue(dashboard.traceability.pendingControls)}</b><span>À traiter</span></article><article><small>EXPÉDITIONS PRÊTES</small><b>{personalValue(dashboard.traceability.shipmentsReady)}</b><span>Lots conformes</span></article></div>
    <div className="source-charts"><article className="source-panel wide"><header><div><small>ACTIVITÉ RÉCENTE</small><h3>Réceptions & consommations</h3></div><span className="source-legend">■ Réceptions <i>■ Consommations</i></span></header><Bars rows={events} value="receptions" secondary="consumptions" /></article><article className="source-panel"><header><div><small>ÉTAT DU STOCK</small><h3>Disponible / consommé</h3></div></header><div className="source-donut" style={{'--fill':`${stockFill}%`} as React.CSSProperties}><b>{Math.round(stockFill)}%</b><span>disponible</span></div></article><article className="source-panel"><header><div><small>ÉVÉNEMENTS</small><h3>Activité par type</h3></div></header><RankedBars rows={eventTypes}/></article><article className="source-panel"><header><div><small>POINTS D’ATTENTION</small><h3>Stocks par statut</h3></div></header><RankedBars rows={operational?.traceability.stockByStatus??[]}/></article><article className="source-panel"><header><div><small>PROJETS</small><h3>Activité par projet</h3></div></header><RankedBars rows={dashboard.traceability.projects?.length?dashboard.traceability.projects:operational?.traceability.projects??[]}/></article><article className="source-panel wide"><header><div><small>TOP CONSOMMATIONS & COMPOSANTS</small><h3>Principales références en stock</h3></div></header><RankedBars rows={parts} value="remaining" /></article><article className="source-panel wide"><header><div><small>JOURNAL</small><h3>Dernières opérations auditées</h3></div></header><div className="source-list">{(operational?.traceability.recentActivity??[]).map((row,index)=><p key={index}><i className="green"/><span>{row.type} · {row.part} · {row.batch}</span><b>{row.time}</b></p>)}</div></article></div>
  </section>;
}

const Brand = () => (
  <div className="brand" aria-label="SAGE 360">
    <img src="/sage-logo.png" alt="Logo SAGE Automotive Interiors" />
    <strong>SAGE 360</strong>
  </div>
);

export default function App() {
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [operational, setOperational] = useState<OperationalData | null>(null);
  const [search, setSearch] = useState('');
  const [newAccountMatricule, setNewAccountMatricule] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [sweetAlert, setSweetAlert] = useState<SweetAlertState>(null);
  const [token, setToken] = useState(() => sessionStorage.getItem('portal-token') ?? '');
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(() => sessionStorage.getItem('portal-password-change') === 'true');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [ssoLaunching, setSsoLaunching] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('ALL');
  const [embeddedUrls, setEmbeddedUrls] = useState<Partial<Record<Exclude<DashboardView, 'ALL'>, string>>>({});
  const [embeddedError, setEmbeddedError] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('portal-read-notifications') ?? '[]'); }
    catch { return []; }
  });
  const [favoriteApps, setFavoriteApps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('portal-favorite-apps') ?? '[]'); }
    catch { return []; }
  });

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    return term
      ? accounts.filter((account) =>
          `${account.fullName} ${account.matricule} ${account.department}`.toLocaleLowerCase('fr').includes(term))
      : accounts;
  }, [accounts, search]);

  async function loadDashboard(accessToken: string) {
    const authorization = `Bearer ${accessToken}`;
    const response = await fetch('/api/dashboard/me', { headers: { Authorization: authorization } });
    if (!response.ok) throw new Error('SESSION_EXPIRED');
    const data: Dashboard = await response.json();
    setDashboard(data);
    if (data.user.admin) {
      const operationalResponse = await fetch('/api/dashboard/operational', { headers: { Authorization: authorization } });
      if (operationalResponse.ok) setOperational(await operationalResponse.json());
      const accountsResponse = await fetch('/api/accounts?size=100', { headers: { Authorization: authorization } });
      if (accountsResponse.ok) {
        const page = await accountsResponse.json();
        setAccounts(page.content);
      }
    }
  }

  useEffect(() => {
    if (!token || dashboard || passwordChangeRequired) return;
    loadDashboard(token).catch(() => {
      sessionStorage.removeItem('portal-token');
      setToken('');
      setError('Votre session a expiré. Reconnectez-vous.');
    });
  }, [token, dashboard, passwordChangeRequired]);

  useEffect(() => {
    if (!token || !dashboard) return;
    let checking = false;
    const verifyActiveSession = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch('/api/dashboard/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          sessionStorage.removeItem('portal-token');
          setToken('');
          setDashboard(null);
          setOperational(null);
          setAccounts([]);
          setEmbeddedUrls({});
          setError('Cette session a été fermée car votre compte s’est connecté sur un autre appareil.');
        }
      } catch {
        // Une panne réseau temporaire ne doit pas fermer une session valide.
      } finally {
        checking = false;
      }
    };
    const interval = window.setInterval(verifyActiveSession, 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void verifyActiveSession();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, dashboard, passwordChangeRequired]);

  useEffect(() => {
    if (!dashboard || !token || dashboardView === 'ALL' || embeddedUrls[dashboardView]) return;
    if (!dashboard.applications.some((app) => app.code === dashboardView && app.hasAccount)) return;
    let cancelled = false;
    setSsoLaunching(true);
    setEmbeddedError('');
    fetch('/api/sso/launch', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const launch = data.applications.find((app: { code: string; url: string }) => app.code === dashboardView);
        if (!launch) throw new Error();
        if (!cancelled) setEmbeddedUrls((current) => ({ ...current, [dashboardView]: launch.url }));
      })
      .catch(() => { if (!cancelled) setEmbeddedError("Le dashboard n'a pas pu être chargé dans le portail."); })
      .finally(() => { if (!cancelled) setSsoLaunching(false); });
    return () => { cancelled = true; };
  }, [dashboard, dashboardView, embeddedUrls, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: matricule, password }),
      });
      if (!response.ok) throw new Error();
      const session = await response.json();
      sessionStorage.setItem('portal-token', session.accessToken);
      sessionStorage.setItem('portal-password-change', String(session.passwordChangeRequired));
      setPasswordChangeRequired(session.passwordChangeRequired);
      setToken(session.accessToken);
      if (session.passwordChangeRequired) {
        setCurrentPassword(password);
      } else {
        await loadDashboard(session.accessToken);
      }
      setPassword('');
    } catch {
      setError('Matricule ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    sessionStorage.removeItem('portal-token');
    setToken('');
    sessionStorage.removeItem('portal-password-change');
    setPasswordChangeRequired(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('');
    setShowPassword(false);
    setTemporaryPassword('');
    setDashboard(null);
    setAccounts([]);
    setOperational(null);
    setEmbeddedUrls({});
    setEmbeddedError('');
    setPassword('');
  }

  function notificationKey(priority: Dashboard['priorities'][number]) {
    return `${priority.source}:${priority.title}`;
  }

  function markNotificationRead(priority: Dashboard['priorities'][number]) {
    const key = notificationKey(priority);
    setReadNotifications((current) => {
      const next = current.includes(key) ? current : [...current, key];
      localStorage.setItem('portal-read-notifications', JSON.stringify(next));
      return next;
    });
  }

  function markAllNotificationsRead() {
    if (!dashboard) return;
    const next = dashboard.priorities.map(notificationKey);
    localStorage.setItem('portal-read-notifications', JSON.stringify(next));
    setReadNotifications(next);
  }

  function toggleFavorite(code: string) {
    setFavoriteApps((current) => {
      const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
      localStorage.setItem('portal-favorite-apps', JSON.stringify(next));
      return next;
    });
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setPasswordMessage(body.detail ?? body.message ?? 'Impossible de modifier le mot de passe.');
      return;
    }
    setPasswordMessage('Mot de passe modifié. Reconnexion requise…');
    setTimeout(() => logout(), 1000);
  }

  async function launchSso(targetCode?: string) {
    const targets = targetCode ? [targetCode] : availableApps.map((app) => app.code);
    const tabs = targets.map(() => window.open('about:blank', '_blank'));
    setSsoLaunching(true);
    try {
      const response = await fetch('/api/sso/launch', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      targets.forEach((code, index) => {
        const launch = data.applications.find((app: { code: string; url: string }) => app.code === code);
        if (launch && tabs[index]) tabs[index]!.location.href = launch.url;
        else tabs[index]?.close();
      });
    } catch {
      tabs.forEach((tab) => tab?.close());
      setError("Impossible d'ouvrir la session unifiée. Réessayez dans quelques instants.");
    } finally { setSsoLaunching(false); }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountMessage('');
    setCreatingAccount(true);
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricule: newAccountMatricule.trim() }),
      });
      if (response.status === 409) {
        setSweetAlert({ title: 'Compte existant', text: 'Ce compte existe déjà.', icon: 'warning' });
        return;
      }
      if (response.status === 404) {
        setSweetAlert({ title: 'Employé introuvable', text: "Cet employé n'existe pas dans la base des employés.", icon: 'error' });
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setAccountMessage(body.detail ?? body.message ?? 'Impossible de créer le compte.');
        return;
      }
      const created: Account = await response.json();
      setAccounts((current) => [created, ...current]);
      setNewAccountMatricule('');
      setAccountMessage('Le compte est créé. Une activation par l’administrateur est requise.');
    } finally {
      setCreatingAccount(false);
    }
  }

  async function activateAccount(username: string) {
    if (temporaryPassword) { setAccountMessage('Masquez le mot de passe temporaire précédent avant une autre activation.'); return; }
    setAccountMessage('');
    try {
    const response = await fetch(`/api/accounts/${encodeURIComponent(username)}/activate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) { setAccountMessage("Impossible d'activer ce compte."); return; }
    const result = await response.json();
    setAccounts((current) => current.map((account) => account.username === username ? result.account : account));
    setTemporaryPassword(result.temporaryPassword);
    } catch { setAccountMessage("L'activation n'a pas pu être confirmée. Rechargez les comptes avant de réessayer."); }
  }

  if (passwordChangeRequired && token) {
    return <main className="login-page"><section className="login-panel">
      <Brand /><h2>Choisissez votre mot de passe personnel</h2>
      <p>Cette étape est obligatoire avant l’accès au portail. Choisissez entre 12 et 72 caractères.</p>
      <form onSubmit={changePassword}>
        <label>Mot de passe temporaire</label><input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        <label>Nouveau mot de passe</label><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} maxLength={72} required />
        <label>Confirmation</label><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} maxLength={72} required />
        {passwordMessage && <p role="status">{passwordMessage}</p>}
        <button>Enregistrer</button><button type="button" onClick={logout}>Déconnexion</button>
      </form>
    </section></main>;
  }

  if (!dashboard) {
    return (
      <main className="login-page">
        <section className="login-aside">
          <Brand />
          <div className="pitch">
            <span className="pill">PORTAIL UNIFIÉ</span>
            <h1>Une seule connexion.<br /><em>Toute votre activité.</em></h1>
            <p>Retrouvez la traçabilité, les ressources humaines et la gestion des plannings dans un espace personnalisé, fiable et sécurisé.</p>
          </div>
          <div className="aside-footer"><span>Traçabilité</span><i /><span>Ressources Humaines</span><i /><span>Gestion des plannings</span></div>
        </section>

        <section className="login-panel">
          <form onSubmit={submit}>
            <p className="eyebrow">BIENVENUE</p>
            <h2>Connectez-vous</h2>
            <p className="sub">Accédez à votre espace SAGE 360</p>

            <label htmlFor="matricule">Matricule</label>
            <input id="matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)}
              inputMode="numeric" autoComplete="username" placeholder="Votre matricule" required autoFocus />

            <label htmlFor="password">Mot de passe</label>
            <input id="password" value={password} onChange={(e) => setPassword(e.target.value)}
              type="password" autoComplete="current-password" placeholder="••••••••••••" required />

            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={loading}>
              <span>{loading ? 'Connexion…' : 'Se connecter'}</span><span aria-hidden>→</span>
            </button>
            <p className="help">À la première connexion, votre mot de passe est votre matricule.</p>
          </form>
        </section>
      </main>
    );
  }

  const isAdmin = Boolean(dashboard.user.admin);
  const availableApps = dashboard.applications.filter((app) => app.hasAccount);
  const hasApp = (code: Exclude<DashboardView, 'ALL'>) => availableApps.some(app => app.code === code);
  const dashboardOptions = ([['ALL','Vue globale'],['PLANNING','Plannings'],['TRACEABILITY','Traçabilité'],['HR','Ressources humaines']] as [DashboardView,string][])
    .filter(([code]) => code === 'ALL' || availableApps.some((app) => app.code === code));
  const planningCompletion = Math.max(0, Math.min(100, n(dashboard.planning?.completionRate)));
  const attentionTotal = n(dashboard.metrics.attentionPoints) + n(dashboard.planning?.lateActions);
  const unreadNotifications = dashboard.priorities.filter((priority) => !readNotifications.includes(notificationKey(priority))).length;
  const isView = (code: Exclude<DashboardView, 'ALL'>) => dashboardView === 'ALL' || dashboardView === code;
  const viewTitle = dashboardView === 'TRACEABILITY' ? 'Dashboard Traçabilité'
    : dashboardView === 'HR' ? 'Dashboard Ressources Humaines'
    : dashboardView === 'PLANNING' ? 'Dashboard Gestion des plannings'
    : 'Centre de pilotage unifié';
  return (
    <>
      <header className="topbar">
        <Brand />
        <div className="profile">
          <div className="notification-center">
            <button className="notification-trigger" onClick={() => setShowNotifications((value) => !value)} aria-label={`${unreadNotifications} notification(s) non lue(s)`}>
              <span aria-hidden>!</span>{unreadNotifications > 0 && <b>{unreadNotifications}</b>}
            </button>
            {showNotifications && <div className="notification-popover">
              <header><div><small>CENTRE DE NOTIFICATIONS</small><h3>Notifications</h3></div><button onClick={markAllNotificationsRead}>Tout marquer comme lu</button></header>
              <div className="notification-list">
                {dashboard.priorities.map((priority) => {
                  const isRead = readNotifications.includes(notificationKey(priority));
                  return <a href={priority.url} className={isRead ? 'read' : ''} key={notificationKey(priority)} onClick={() => markNotificationRead(priority)}>
                    <i className={`priority-dot ${priority.level}`} /><div><b>{priority.title}</b><small>{priority.source} · {priority.detail}</small></div>
                  </a>;
                })}
                {dashboard.priorities.length === 0 && <p>Aucune nouvelle notification.</p>}
              </div>
              <button className="open-task-center" onClick={() => { setShowNotifications(false); setShowTasks(true); }}>Ouvrir le centre de tâches →</button>
            </div>}
          </div>
          <span className="avatar">{dashboard.user.name.slice(0, 2)}</span>
          <span><b>{dashboard.user.name}</b><small>{dashboard.user.jobTitle}</small></span>
          {dashboard.user.username !== 'admin' && <button onClick={() => setShowPassword(true)}>Mot de passe</button>}
          <button onClick={logout}>Déconnexion</button>
        </div>
      </header>
      <div className="workspace">
        <aside><nav><button className={dashboardView === 'ALL' ? 'active' : ''} onClick={() => setDashboardView('ALL')}>⌂ <span>Vue globale</span></button>{!isAdmin && <button onClick={() => setShowTasks(true)}>✓ <span>Mes tâches</span>{dashboard.priorities.length > 0 && <b className="nav-count">{dashboard.priorities.length}</b>}</button>}{dashboardOptions.length>1&&<p>APPLICATIONS AUTORISÉES</p>}{dashboardOptions.slice(1).map(([code,label])=><button key={code} className={dashboardView === code ? 'active' : ''} onClick={() => setDashboardView(code)}>{code==='PLANNING'?'▦':code==='TRACEABILITY'?'◇':'♙'} <span>{label}</span></button>)}{isAdmin && <><p>ADMINISTRATION</p><button>⚙ <span>Comptes utilisateurs</span></button></>}</nav></aside>
        <main className={`dashboard view-${dashboardView.toLowerCase()}`}>
          <section className="welcome">
            <div><p className="eyebrow">{viewTitle.toUpperCase()}</p><h1>{dashboardView === 'ALL' ? `Bonjour ${dashboard.user.name.split(' ')[0]} 👋` : viewTitle}</h1><p>{dashboardView === 'ALL' ? `${dashboard.user.department} · ${dashboard.user.jobTitle}` : `Indicateurs et activité dédiés · ${dashboard.user.name}`}</p></div>
            <div className="welcome-meta"><span className="sync">● 3 sources synchronisées</span><small>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</small></div>
          </section>
          <section className="dashboard-switcher" aria-label="Choisir le dashboard">
            {dashboardOptions.map(([code,label]) => <button key={code} className={dashboardView === code ? 'active' : ''} onClick={() => setDashboardView(code)}>{label}</button>)}
          </section>
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 0 && <UnifiedTopKpis dashboard={dashboard}/>} 
          {dashboardView === 'ALL' && <section className="app-grid app-grid-top">
            {availableApps.map((app) => (
              <article className={`app-card ${app.code.toLocaleLowerCase()}`} key={app.code}>
                <button className={`favorite-button ${favoriteApps.includes(app.code) ? 'selected' : ''}`} onClick={() => toggleFavorite(app.code)} aria-label={favoriteApps.includes(app.code) ? `Retirer ${app.label} des favoris` : `Ajouter ${app.label} aux favoris`}>{favoriteApps.includes(app.code) ? '★' : '☆'}</button>
                <span className="status">● COMPTE ACTIF</span><small>APPLICATION</small><h2>{app.label}</h2>
                <p>{app.code === 'HR'
                  ? 'Équipes, absences et documents collaborateurs.'
                  : app.code === 'PLANNING'
                    ? 'Projets, modifications ECR, jalons et actions planifiées.'
                    : 'Lots, contrôles qualité et expéditions en temps réel.'}</p>
                <dl className="access-data">
                  <div><dt>Identifiant</dt><dd>{app.identifier || dashboard.user.matricule}</dd></div>
                  {app.email && <div><dt>E-mail</dt><dd>{app.email}</dd></div>}
                  {app.role && <div><dt>Rôle</dt><dd>{app.role}</dd></div>}
                  <div><dt>Mot de passe</dt><dd>Votre mot de passe personnel</dd></div>
                </dl>
                <a href={app.url} onClick={(event) => { event.preventDefault(); launchSso(app.code); }}>Accéder sans se reconnecter <b>→</b></a>
              </article>
            ))}
          </section>}
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 1 && <button className="launch-all" onClick={() => launchSso()} disabled={ssoLaunching}><span>✦</span><b>{ssoLaunching ? 'Ouverture sécurisée…' : `Ouvrir mes ${availableApps.length} applications`}</b><small>Une seule connexion · aucun mot de passe redemandé</small><strong>→</strong></button>}
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 0 && <section className="command-center">
            <div className="command-copy">
              <span className="command-kicker">VOTRE JOURNÉE EN UN COUP D'ŒIL</span>
              <h2>{attentionTotal > 0 ? `${attentionTotal} point${attentionTotal > 1 ? 's' : ''} mérite${attentionTotal > 1 ? 'nt' : ''} votre attention` : 'Tout est sous contrôle'}</h2>
              <p>Une lecture personnalisée des seules applications associées à votre compte.</p>
              <div className="source-pills">{availableApps.map((app) => <span key={app.code}>● {app.label}</span>)}</div>
            </div>
            <div className="command-score">
              <div className="score-ring" style={{ '--score': `${Math.max(12, 100 - Math.min(attentionTotal * 8, 88))}%` } as React.CSSProperties}><b>{Math.max(12, 100 - Math.min(attentionTotal * 8, 88))}</b><span>indice focus</span></div>
            </div>
            <div className="command-kpis">
              {hasApp('TRACEABILITY') && <div><span className="kpi-symbol blue">?</span><p><small>ACTIONS DU JOUR</small><b>{fmt(dashboard.traceability.lotsToday)}</b></p></div>}
              {hasApp('HR') && <div><span className="kpi-symbol violet">♙</span><p><small>PRÉSENCE</small><b>{dashboard.hr.presenceStatus || '—'}</b></p></div>}
              {hasApp('PLANNING') && <div><span className="kpi-symbol teal">?</span><p><small>ACTIONS ECR OUVERTES</small><b>{fmt(dashboard.planning?.openActions)}</b></p></div>}
              <div><span className="kpi-symbol amber">!</span><p><small>PRIORITÉS</small><b>{attentionTotal}</b></p></div>
            </div>
          </section>}
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 0 && <UnifiedVisualDashboard dashboard={dashboard} />}
          {!isAdmin && dashboardView === 'ALL' && <section className="module-portfolios">{hasApp('PLANNING') && <ModuleExplorer view="PLANNING" compact/>}{hasApp('HR') && <ModuleExplorer view="HR" compact/>}{hasApp('TRACEABILITY') && <ModuleExplorer view="TRACEABILITY" compact/>}</section>}
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 0 && <PersonalizedAnalytics dashboard={dashboard} />}
          {dashboardView !== 'ALL' && <section className="embedded-dashboard exact-application-dashboard">
            <header>
              <div><span>DASHBOARD ORIGINAL · CONNEXION SSO</span><h2>{viewTitle}</h2><p>Le dashboard est affiché tel qu’il existe dans l’application source.</p></div>
              <button onClick={() => launchSso(dashboardView)} disabled={ssoLaunching}>Ouvrir l’application complète ↗</button>
            </header>
            {embeddedUrls[dashboardView]
              ? <iframe src={embeddedUrls[dashboardView]} title={`Dashboard original ${viewTitle}`} allow="fullscreen" />
              : <div className="embedded-loading" role="status">{embeddedError || `Connexion automatique à ${viewTitle} et chargement du dashboard…`}</div>}
          </section>}
          {isAdmin && <section className="metrics">
            <article><span>◫</span><small>LOTS EN BASE</small><b>{operational ? fmt(operational.traceability.totals.batches) : '—'}</b></article>
            <article><span>♙</span><small>COLLABORATEURS ACTIFS</small><b>{operational ? fmt(operational.hr.totals.employees) : '—'}</b></article>
            <article><span>!</span><small>ANOMALIES OUVERTES</small><b>{operational ? fmt(operational.traceability.totals.openissues) : '—'}</b></article>
            <article><span>✓</span><small>POINTAGES ANALYSÉS</small><b>{operational ? fmt(operational.hr.totals.attendancerecords) : '—'}</b></article>
          </section>}
          {operational && <section className="analytics">
            <div className="source-health">
              <span className={operational.traceability.connected ? 'online' : 'offline'}>● Traçabilité {operational.traceability.connected ? 'connectée' : 'indisponible'}</span>
              <span className={operational.hr.connected ? 'online' : 'offline'}>● RH {operational.hr.connected ? 'connectée' : 'indisponible'}</span>
              <span className={operational.planning.connected ? 'online' : 'offline'}>● Plannings {operational.planning.connected ? 'connectée' : 'indisponible'}</span>
              <small>Extraction réelle · {new Date(operational.generatedAt).toLocaleString('fr-FR')}</small>
            </div>
            <div className="chart-grid">
              <article className="chart-card wide"><header><div><small>TRAÇABILITÉ</small><h2>Événements sur 14 jours</h2></div><span className="chart-legend">■ Réceptions <span>■ Consommations</span></span></header><Bars rows={operational.traceability.dailyEvents} value="receptions" secondary="consumptions" /></article>
              <article className="chart-card"><header><div><small>TRAÇABILITÉ</small><h2>Types d'événements</h2></div></header><RankedBars rows={operational.traceability.eventTypes} /></article>
              <article className="chart-card"><header><div><small>STOCK</small><h2>Quantités réelles</h2></div></header><div className="stock-gauge"><div style={{ '--fill': `${n(operational.traceability.totals.remainingquantity) / Math.max(1, n(operational.traceability.totals.receivedquantity)) * 100}%` } as React.CSSProperties}><b>{fmt(operational.traceability.totals.remainingquantity)}</b><span>restant sur {fmt(operational.traceability.totals.receivedquantity)}</span></div></div></article>
              <article className="chart-card wide"><header><div><small>RESSOURCES HUMAINES</small><h2>Présences et absences sur 14 jours</h2></div><span className="chart-legend">■ Présents <span>■ Absents</span></span></header><Bars rows={operational.hr.dailyPresence} value="present" secondary="absent" /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Effectif par département</h2></div></header><RankedBars rows={operational.hr.departments} value="total" /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Répartition par shift</h2></div></header><RankedBars rows={operational.hr.shifts} /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Lignes de production</h2></div></header><RankedBars rows={operational.hr.productionLines} /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Motifs d'absence · 30 jours</h2></div></header><RankedBars rows={operational.hr.absenceReasons} /></article>
              <article className="chart-card wide"><header><div><small>TRAÇABILITÉ</small><h2>Principales références en stock</h2></div></header><div className="parts-table"><div><b>Référence</b><b>Lots</b><b>Reçu</b><b>Restant</b></div>{operational.traceability.topParts.map((row) => <div key={row.label}><strong>{row.label}</strong><span>{fmt(row.batches)}</span><span>{fmt(row.received)}</span><span>{fmt(row.remaining)}</span></div>)}</div></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Heures supplémentaires</h2></div></header><Bars rows={operational.hr.overtime} value="value" /></article>
              <article className="chart-card wide planning-chart"><header><div><small>GESTION DES PLANNINGS</small><h2>Répartition des actions ECR</h2></div><span className="chart-legend teal-text">■ Workflow actif</span></header><RankedBars rows={operational.planning.status} /></article>
              <article className="chart-card"><header><div><small>PLANNINGS</small><h2>Portefeuille ECR</h2></div></header><div className="planning-totals"><b>{fmt(operational.planning.totals.projects)}</b><span>projets actifs</span><div><strong>{fmt(operational.planning.totals.actions)}</strong> actions</div><div className="late"><strong>{fmt(operational.planning.totals.lateactions)}</strong> en retard</div></div></article>
            </div>
          </section>}
          {!isAdmin && dashboardView === 'ALL' && <section className="summary-grid">
            {hasApp('TRACEABILITY') && isView('TRACEABILITY') && <article className="summary-card trace-summary">
              <div className="panel-title"><div><p className="eyebrow">TRAÇABILITÉ</p><h2>Mon activité opérationnelle</h2></div><a href="http://localhost:5173/">Ouvrir →</a></div>
              <div className="summary-values">
                <div><b>{personalValue(dashboard.traceability.lotsToday)}</b><span>Actions aujourd'hui</span></div>
                <div><b>{personalValue(dashboard.traceability.pendingControls)}</b><span>Anomalies ouvertes</span></div>
                <div className={dashboard.traceability.nonConformities ? 'attention' : ''}><b>{personalValue(dashboard.traceability.nonConformities)}</b><span>Non-conformités</span></div>
                <div><b>{personalValue(dashboard.traceability.shipmentsReady)}</b><span>Expéditions prêtes</span></div>
              </div>
              <small className="updated">Dernière mise à jour : {dashboard.traceability.lastUpdate ? new Date(dashboard.traceability.lastUpdate).toLocaleString('fr-FR') : 'aucune activité'}</small>
            </article>}
            {hasApp('HR') && isView('HR') && <article className="summary-card hr-summary">
              <div className="panel-title"><div><p className="eyebrow">RESSOURCES HUMAINES</p><h2>{dashboard.user.manager ? 'Mon équipe & moi' : 'Ma situation RH'}</h2></div><a href="http://localhost:5170/">Ouvrir →</a></div>
              <div className="summary-values">
                <div><b className="present">● {personalValue(dashboard.hr.presenceStatus)}</b><span>Statut du jour</span></div>
                <div><b>{personalValue(dashboard.hr.leaveBalance)}</b><span>Jours de congé</span></div>
                <div><b>{personalValue(dashboard.hr.pendingRequests)}</b><span>Demandes en attente</span></div>
                {dashboard.user.manager && <div><b>{personalValue(dashboard.hr.teamAbsences)}</b><span>Absences équipe</span></div>}
              </div>
              <small className="updated">{dashboard.hr.nextEvent}</small>
            </article>}
            {isView('PLANNING') && dashboard.applications.some((app) => app.code === 'PLANNING' && app.hasAccount) && <article className="summary-card planning-summary">
              <div className="panel-title"><div><p className="eyebrow">GESTION DES PLANNINGS</p><h2>Mes engagements ECR</h2></div><a href="http://localhost:3000/">Ouvrir →</a></div>
              <div className="planning-overview">
                <div className="mini-ring" style={{ '--score': `${planningCompletion}%` } as React.CSSProperties}><b>{planningCompletion}%</b><span>réalisé</span></div>
                <div className="planning-stats"><div><b>{personalValue(dashboard.planning.activeProjects)}</b><span>Projets actifs</span></div><div><b>{personalValue(dashboard.planning.openActions)}</b><span>Actions ouvertes</span></div><div className={dashboard.planning.lateActions ? 'danger' : ''}><b>{personalValue(dashboard.planning.lateActions)}</b><span>En retard</span></div></div>
              </div>
              <div className="progress-track"><i style={{ width: `${planningCompletion}%` }} /></div>
              <small className="updated">{personalValue(dashboard.planning.completedActions)} action(s) finalisée(s)</small>
            </article>}
          </section>}
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 1 && <section className="cross-view">
            <article className="cross-chart">
              <div className="panel-title"><div><p className="eyebrow">VISION CROISÉE</p><h2>Charge & attention par application</h2></div><span className="live-chip">TEMPS RÉEL</span></div>
              <div className="cross-bars">
                {[
                  ['Traçabilité', n(dashboard.traceability.pendingControls), '#687b18'],
                  ['Ressources humaines', n(dashboard.hr.pendingRequests), '#89974d'],
                  ['Gestion des plannings', n(dashboard.planning?.lateActions), '#78852f'],
                ].filter((_, index) => [hasApp('TRACEABILITY'), hasApp('HR'), hasApp('PLANNING')][index]).map(([label, value, color]) => <div key={String(label)}><span>{label}<b>{value}</b></span><i><em style={{ width: `${Math.max(Number(value) ? 12 : 2, Number(value) / Math.max(1, attentionTotal) * 100)}%`, background: String(color) }} /></i></div>)}
              </div>
            </article>
            <article className="focus-card">
              <span className="focus-icon">✦</span><p className="eyebrow">RECOMMANDATION</p><h2>{hasApp('PLANNING') && n(dashboard.planning?.lateActions) > 0 ? 'Commencez par le planning ECR' : hasApp('TRACEABILITY') && n(dashboard.traceability.pendingControls) > 0 ? 'Priorisez les anomalies qualité' : hasApp('HR') && n(dashboard.hr.pendingRequests) > 0 ? 'Consultez vos demandes RH' : 'Planifiez votre prochaine action'}</h2><p>{attentionTotal > 0 ? "Le cockpit a identifié la zone qui concentre le plus de points d'attention aujourd'hui." : 'Aucune urgence détectée dans vos applications.'}</p>
            </article>
          </section>}
          {!isAdmin && dashboardView === 'ALL' && <section className="detail-grid">
            <article className="detail-card">
              <div className="panel-title"><div><p className="eyebrow">À TRAITER</p><h2>Mes priorités</h2></div></div>
              {dashboard.priorities.filter((priority) => dashboardView === 'ALL' || (dashboardView === 'HR' ? priority.source === 'RH' : dashboardView === 'PLANNING' ? priority.source === 'Plannings' : priority.source.includes('Tra'))).map((priority) => (
                <a className="priority-row" href={priority.url} key={`${priority.source}-${priority.title}`}>
                  <span className={`priority-dot ${priority.level}`} />
                  <div><b>{priority.title}</b><small>{priority.source} · {priority.detail}</small></div><strong>→</strong>
                </a>
              ))}
              {dashboard.priorities.length === 0 && <p>Aucune priorité issue de vos données.</p>}
            </article>
            <article className="detail-card">
              <div className="panel-title"><div><p className="eyebrow">ACTIVITÉ</p><h2>Dernières informations</h2></div></div>
              {dashboard.recentActivity.map((activity) => (
                <div className="activity-row" key={`${activity.source}-${activity.title}`}>
                  <span>{activity.source === 'RH' ? 'RH' : activity.source === 'Plannings' ? 'PL' : 'TR'}</span>
                  <div><b>{activity.title}</b><small>{activity.source} · {activity.time}</small></div>
                </div>
              ))}
              {dashboard.recentActivity.length === 0 && <p>Aucune activité enregistrée pour votre compte.</p>}
            </article>
          </section>}
          {isAdmin && (
            <section className="admin-panel">
              <div className="admin-head"><div><p className="eyebrow">ADMINISTRATION</p><h2>Comptes utilisateurs</h2><p>Ajoutez un compte uniquement avec son matricule et consultez ses applications métier liées.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employé…" /></div>
              <form className="account-create" onSubmit={createAccount}><label htmlFor="new-account-matricule">Nouveau matricule</label><input id="new-account-matricule" inputMode="numeric" pattern="[0-9]+" value={newAccountMatricule} onChange={(e) => { setNewAccountMatricule(e.target.value); setAccountMessage(''); }} placeholder="Ex. 3745" required /><button disabled={creatingAccount}>{creatingAccount ? 'Création…' : 'Ajouter le compte'}</button>{accountMessage && <p role="status">{accountMessage}</p>}</form>
              {temporaryPassword && <div role="status"><p>Mot de passe temporaire (affiché une seule fois). Transmettez-le au titulaire par un canal privé après vérification de son identité.</p><code>{temporaryPassword}</code><button onClick={() => setTemporaryPassword('')}>Masquer</button></div>}
              <div className="table-wrap"><table><thead><tr><th>Employé</th><th>Matricule</th><th>Département</th><th>Applications liées</th><th>Statut</th></tr></thead><tbody>
                {filteredAccounts.map((account) => <tr key={account.id}><td><b>{account.fullName}</b><small>{account.jobTitle}</small></td><td>{account.matricule}</td><td>{account.department}</td><td><div className="application-tags">{account.applications.length ? account.applications.map((app) => <span key={app}>{app === 'HR' ? 'RH' : app === 'PLANNING' ? 'Planning' : 'Traçabilité'}</span>) : <small>Aucune application</small>}</div></td><td><span className="account-status">{account.accountStatus === 'ACTIVE' ? 'Actif' : account.accountStatus === 'PASSWORD_CHANGE_REQUIRED' ? 'Mot de passe à changer' : account.accountStatus === 'DISABLED' ? 'Désactivé' : 'À activer'}</span>{account.accountStatus === 'ACTIVATION_REQUIRED' && <button onClick={() => activateAccount(account.username)}>Activer</button>}</td></tr>)}
              </tbody></table></div>
            </section>
          )}
        </main>
      </div>
      {showPassword && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPassword(false)}>
        <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowPassword(false)} aria-label="Fermer">×</button>
          <p className="eyebrow">SÉCURITÉ DU COMPTE</p>
          <h2 id="password-title">Changer le mot de passe</h2>
          <p>Choisissez entre 12 et 72 caractères. Toutes les sessions devront être reconnectées.</p>
          <form onSubmit={changePassword}>
            <label>Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus />
            <label>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} maxLength={72} required />
            <label>Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} maxLength={72} required />
            {passwordMessage && <p className="password-message" role="status">{passwordMessage}</p>}
            <div className="modal-actions"><button type="button" onClick={() => setShowPassword(false)}>Annuler</button><button className="save-password">Enregistrer</button></div>
          </form>
        </section>
      </div>}
      {sweetAlert && <div className="sweet-alert-backdrop" role="presentation" onMouseDown={() => setSweetAlert(null)}>
        <section className="sweet-alert" role="alertdialog" aria-modal="true" aria-labelledby="sweet-alert-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className={`sweet-alert-icon ${sweetAlert.icon}`} aria-hidden>{sweetAlert.icon === 'error' ? '×' : '!'}</div>
          <h2 id="sweet-alert-title">{sweetAlert.title}</h2>
          <p>{sweetAlert.text}</p>
          <button autoFocus onClick={() => setSweetAlert(null)}>OK</button>
        </section>
      </div>}
      {showTasks && <div className="modal-backdrop task-backdrop" role="presentation" onMouseDown={() => setShowTasks(false)}>
        <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="tasks-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowTasks(false)} aria-label="Fermer">×</button>
          <p className="eyebrow">CENTRE DE PILOTAGE</p><h2 id="tasks-title">Mes tâches prioritaires</h2>
          <p>Les éléments à traiter sont consolidés depuis vos applications autorisées.</p>
          <div className="task-summary"><div><b>{dashboard.priorities.length}</b><span>à traiter</span></div><div><b>{dashboard.priorities.filter((item) => item.level === 'urgent').length}</b><span>urgentes</span></div><div><b>{unreadNotifications}</b><span>non lues</span></div></div>
          <div className="task-list">{dashboard.priorities.map((priority) => <a href={priority.url} key={notificationKey(priority)} onClick={() => markNotificationRead(priority)}><i className={`priority-dot ${priority.level}`} /><div><small>{priority.source}</small><b>{priority.title}</b><span>{priority.detail}</span></div><strong>Ouvrir →</strong></a>)}{dashboard.priorities.length === 0 && <div className="empty-tasks">✓ Aucune tâche prioritaire pour le moment.</div>}</div>
        </section>
      </div>}
    </>
  );
}
