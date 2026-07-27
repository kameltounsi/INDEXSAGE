"use client";

import { useEffect, useMemo, useState } from "react";

type View = "all" | "planning" | "trace" | "rh";
type IconName = "grid" | "calendar" | "route" | "users" | "chart" | "bell" | "search" | "download" | "chevron" | "clock" | "check" | "alert" | "box" | "trend";

const icons: Record<IconName, string> = {
  grid:"â–¦", calendar:"â–£", route:"â—‡", users:"â™™", chart:"âŒ", bell:"â—Œ", search:"âŒ•", download:"â†“", chevron:"âŒ„", clock:"â—·", check:"âœ“", alert:"!", box:"â–¡", trend:"â†—"
};

const views = {
  all: { label:"Vue globale", short:"Tous", color:"blue", title:"Vue dâ€™ensemble", subtitle:"Une vision consolidÃ©e de vos opÃ©rations, de vos Ã©quipes et de vos plannings.", status:"Performance globale", score:"92,8%" },
  planning: { label:"Planning", short:"Planning", color:"orange", title:"Pilotage des plannings", subtitle:"Charge, capacitÃ© et avancement de lâ€™ensemble des projets en temps rÃ©el.", status:"Respect des dÃ©lais", score:"87,5%" },
  trace: { label:"TraÃ§abilitÃ©", short:"TraÃ§abilitÃ©", color:"teal", title:"ContrÃ´le de la traÃ§abilitÃ©", subtitle:"Suivez chaque lot, de sa rÃ©ception jusquâ€™Ã  son expÃ©dition.", status:"Taux de conformitÃ©", score:"98,4%" },
  rh: { label:"Ressources humaines", short:"RH", color:"violet", title:"Capital humain", subtitle:"PrÃ©sence, compÃ©tences et dynamique de vos collaborateurs.", status:"Indice dâ€™engagement", score:"91,2%" },
} as const;

const kpis: Record<View, Array<[string,string,string,string,IconName]>> = {
  all:[["Lots traitÃ©s","1 284","+8,2%","vs pÃ©riode prÃ©cÃ©dente","box"],["Projets Ã  lâ€™heure","87,5%","+3,1%","7 jalons cette semaine","calendar"],["PrÃ©sence","94,7%","+1,4%","43 sur 47 prÃ©sents","users"],["Alertes critiques","3","âˆ’40%","7 points dâ€™attention","alert"]],
  planning:[["Projets actifs","24","+3","6 Ã©quipes mobilisÃ©es","grid"],["Jalons Ã  lâ€™heure","87,5%","+3,1%","42 sur 48 validÃ©s","check"],["Charge moyenne","82%","âˆ’4,0%","CapacitÃ© mieux rÃ©partie","chart"],["Actions en retard","9","âˆ’18%","4 critiques","alert"]],
  trace:[["Lots actifs","1 284","+8,2%","Aujourdâ€™hui","box"],["ConformitÃ©","98,4%","+1,6%","Objectif 97%","check"],["Temps de cycle","2h 18","âˆ’12 min","RÃ©ception â†’ sortie","clock"],["Incidents ouverts","7","âˆ’3","3 prioritaires","alert"]],
  rh:[["Collaborateurs","47","+2","4 dÃ©partements","users"],["PrÃ©sence","94,7%","+1,4%","43 prÃ©sents","check"],["Heures formation","186 h","+24%","Ce trimestre","trend"],["CongÃ©s Ã  venir","8","+2","Sur 30 jours","calendar"]]
};

const chartData: Record<View, number[]> = { all:[62,71,66,79,74,88,82,91,84,93,89,96], planning:[58,64,61,72,69,77,75,83,81,89,86,92], trace:[70,76,73,85,80,89,86,94,91,96,93,98], rh:[75,78,76,83,81,86,84,90,88,94,91,95] };
const days=["01","03","05","07","09","11","13","15","17","19","21","23"];

function MiniSpark({data}:{data:number[]}) { return <div className="mini-spark">{data.map((n,i)=><i key={i} style={{height:`${Math.max(18,n-45)}%`}} />)}</div> }
function Ring({value,label}:{value:number,label:string}) { return <div className="ring" style={{"--ring":`${value*3.6}deg`} as React.CSSProperties}><div><b>{value}%</b><span>{label}</span></div></div> }

export default function Dashboard() {
  const [view,setView]=useState<View>("all");
  const [range,setRange]=useState("30 jours");
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("view");if(requested&&requested in views)setView(requested as View)},[]);
  const cfg=views[view]; const data=chartData[view];
  const line=useMemo(()=>data.map((v,i)=>`${i/(data.length-1)*100},${100-(v-50)*1.6}`).join(" "),[data]);
  const barLabels=view==="planning"?["Conception","MÃ©thodes","Production","QualitÃ©"]:view==="rh"?["Production","QualitÃ©","Logistique","Admin."]:view==="trace"?["RÃ©ception","Production","ContrÃ´le","ExpÃ©dition"]:["TraÃ§abilitÃ©","Planning","RH","QualitÃ©"];
  const barVals=view==="planning"?[92,78,84,68]:view==="rh"?[90,90,92,100]:view==="trace"?[96,83,72,58]:[94,88,95,84];
  return <main className={`app theme-${cfg.color}`}>
    <aside className="rail">
      <a className="logo" href="#" aria-label="SAGE 360"><img src="/sage-logo.png" alt="Logo SAGE Automotive Interiors"/><span>SAGE 360</span></a>
      <nav>
        <p>ESPACE DE PILOTAGE</p>
        {(Object.keys(views) as View[]).map((key)=><button key={key} onClick={()=>setView(key)} className={view===key?"active":""}><span>{icons[key==="all"?"grid":key==="planning"?"calendar":key==="trace"?"route":"users"]}</span><b>{views[key].label}</b>{key==="all"&&<em>4</em>}</button>)}
        <p>ANALYSE</p><button><span>{icons.chart}</span><b>Rapports</b></button><button><span>{icons.clock}</span><b>Historique</b></button>
      </nav>
      <div className="sync"><span><i/> SystÃ¨mes synchronisÃ©s</span><b>3 / 3</b><small>Mise Ã  jour il y a 2 min</small></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="mobile-brand"><img src="/sage-logo.png" alt=""/><b>SAGE 360</b></div><label className="search"><span>{icons.search}</span><input aria-label="Rechercher" placeholder="Rechercher un lot, un projet, un collaborateurâ€¦"/><kbd>âŒ˜ K</kbd></label><div className="top-actions"><button className="round">{icons.bell}<i>3</i></button><div className="person"><span>KT</span><p><b>Kamel Tounsi</b><small>Responsable opÃ©rations</small></p><em>âŒ„</em></div></div></header>
      <div className="page">
        <div className="headline"><div><div className="breadcrumb">PILOTAGE <span>/</span> {cfg.label.toUpperCase()}</div><h1>{cfg.title}</h1><p>{cfg.subtitle}</p></div><div className="actions"><button>{icons.download} Exporter</button><select value={range} onChange={e=>setRange(e.target.value)} aria-label="PÃ©riode"><option>7 jours</option><option>30 jours</option><option>Ce trimestre</option></select></div></div>
        <div className="view-switch" role="tablist">{(Object.keys(views) as View[]).map(key=><button role="tab" aria-selected={view===key} className={view===key?"active":""} onClick={()=>setView(key)} key={key}><span>{icons[key==="all"?"grid":key==="planning"?"calendar":key==="trace"?"route":"users"]}</span>{views[key].short}</button>)}</div>
        <section className="kpi-grid">{kpis[view].map((k,i)=><article className="kpi" key={k[0]}><div className="kpi-icon">{icons[k[4]]}</div><div className="delta">{k[2]}</div><small>{k[0]}</small><strong>{k[1]}</strong><footer><span>{k[3]}</span><MiniSpark data={data.slice(i,i+6).concat(data.slice(0,i))}/></footer></article>)}</section>
        <section className="grid-main">
          <article className="card performance"><div className="card-head"><div><span className="overline">{cfg.status}</span><h2>Ã‰volution de la performance</h2><p>Comparaison avec la pÃ©riode prÃ©cÃ©dente</p></div><div className="legend"><span><i/>Actuel</span><span><i/>PrÃ©cÃ©dent</span></div></div><div className="score"><strong>{cfg.score}</strong><em>â†— +4,6%</em></div><div className="line-chart"><div className="y-axis"><span>100</span><span>90</span><span>80</span><span>70</span><span>60</span></div><div className="plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Courbe de performance"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".25"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${line} 100,100`} fill="url(#fill)"/><polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="x-axis">{days.map(d=><span key={d}>{d}</span>)}</div></div></div></article>
          <article className="card health"><div className="card-head"><div><span className="overline">SYNTHÃˆSE</span><h2>SantÃ© opÃ©rationnelle</h2><p>Indicateurs clÃ©s du jour</p></div><button>â€¢â€¢â€¢</button></div><Ring value={view==="trace"?98:view==="planning"?88:view==="rh"?94:93} label="score global"/><div className="health-list"><div><span className="dot green"/>Optimal <b>6</b></div><div><span className="dot amber"/>Ã€ surveiller <b>3</b></div><div><span className="dot red"/>Critique <b>1</b></div></div></article>
          <article className="card distribution"><div className="card-head"><div><span className="overline">RÃ‰PARTITION</span><h2>{view==="rh"?"PrÃ©sence par dÃ©partement":view==="planning"?"Avancement par Ã©quipe":view==="trace"?"Flux des lots":"Performance par application"}</h2><p>Valeurs consolidÃ©es en temps rÃ©el</p></div><button>Voir le dÃ©tail â†’</button></div><div className="h-bars">{barLabels.map((label,i)=><div key={label}><p><b>{label}</b><span>{barVals[i]}%</span></p><i><b style={{width:`${barVals[i]}%`}}/></i><small>{Math.round(barVals[i]*.47)} / 47</small></div>)}</div></article>
          <article className="card activity"><div className="card-head"><div><span className="overline">EN DIRECT</span><h2>ActivitÃ© rÃ©cente</h2><p>DerniÃ¨res opÃ©rations enregistrÃ©es</p></div><span className="live"><i/> LIVE</span></div><div className="timeline">{[
            [view==="planning"?"Jalon validÃ©":"ContrÃ´le qualitÃ© validÃ©",view==="rh"?"Dossier de LeÃ¯la Mansour":"Lot LT-2847", "Il y a 8 min","check"],
            [view==="rh"?"Demande de congÃ© approuvÃ©e":"Planning mis Ã  jour",view==="trace"?"Ligne de production 03":"Projet Atlas Â· Ã‰quipe A", "Il y a 24 min","calendar"],
            [view==="trace"?"Lot placÃ© en quarantaine":"Nouveau collaborateur ajoutÃ©",view==="planning"?"Action ECR-102":"Ahmed Ben Youssef", "Il y a 51 min","alert"]
          ].map((a,i)=><div key={i}><span className={`event e${i}`}>{icons[a[3] as IconName]}</span><p><b>{a[0]}</b><small>{a[1]}</small></p><time>{a[2]}</time></div>)}</div><button className="full">Voir toute lâ€™activitÃ© <span>â†’</span></button></article>
        </section>
        <section className="lower-grid"><article className="card alerts"><div className="card-head"><div><span className="overline">PRIORITÃ‰S</span><h2>Alertes nÃ©cessitant votre attention</h2></div><button>Tout afficher</button></div>{[["Critique",view==="planning"?"Jalon dÃ©passÃ© de 3 jours":"TempÃ©rature hors plage","Ligne 02 Â· Ã€ traiter immÃ©diatement","12 min"],["Important",view==="rh"?"Couverture Ã©quipe insuffisante":"CapacitÃ© sous lâ€™objectif","Ã‰quipe du soir Â· 82% de capacitÃ©","48 min"],["Information",view==="trace"?"ContrÃ´le documentaire requis":"Validation en attente","Action assignÃ©e Ã  Sarra Trabelsi","2 h"]].map((a,i)=><div className="alert-row" key={a[1]}><span className={`severity s${i}`}>{i?"!":"!!"}</span><p><em>{a[0]}</em><b>{a[1]}</b><small>{a[2]}</small></p><time>{a[3]}</time><button>â†’</button></div>)}</article><article className="card goal"><div className="card-head"><div><span className="overline">OBJECTIF MENSUEL</span><h2>Progression globale</h2></div><b>Juillet</b></div><div className="goal-number"><strong>84%</strong><span>1 284 <small>/ 1 520 unitÃ©s</small></span></div><i className="goal-bar"><b/></i><div className="goal-foot"><span><i className="dot green"/>Dans les temps</span><b>6 jours restants</b></div></article></section>
        <footer className="page-foot"><span><i/> DonnÃ©es synchronisÃ©es il y a 2 min</span><p>SAGE 360 Â· Centre de pilotage unifiÃ©</p><button>â†» Actualiser</button></footer>
      </div>
    </section>
  </main>
}


