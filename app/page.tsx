"use client";

import { useEffect, useMemo, useState } from "react";

type View = "all" | "planning" | "trace" | "rh";
type IconName = "grid" | "calendar" | "route" | "users" | "chart" | "bell" | "search" | "download" | "chevron" | "clock" | "check" | "alert" | "box" | "trend";

const icons: Record<IconName, string> = {
  grid:"▦", calendar:"▣", route:"◇", users:"♙", chart:"⌁", bell:"◌", search:"⌕", download:"↓", chevron:"⌄", clock:"◷", check:"✓", alert:"!", box:"□", trend:"↗"
};

const views = {
  all: { label:"Vue globale", short:"Tous", color:"blue", title:"Vue d'ensemble", subtitle:"Une vision consolidée de vos opérations, de vos équipes et de vos plannings.", status:"Performance globale", score:"92,8%" },
  planning: { label:"Planning", short:"Planning", color:"orange", title:"Pilotage des plannings", subtitle:"Charge, capacité et avancement de l'ensemble des projets en temps réel.", status:"Respect des délais", score:"87,5%" },
  trace: { label:"Traçabilité", short:"Traçabilité", color:"teal", title:"Contrôle de la traçabilité", subtitle:"Suivez chaque lot, de sa réception jusqu'à son expédition.", status:"Taux de conformité", score:"98,4%" },
  rh: { label:"Ressources humaines", short:"RH", color:"violet", title:"Capital humain", subtitle:"Présence, compétences et dynamique de vos collaborateurs.", status:"Indice d'engagement", score:"91,2%" },
} as const;

const kpis: Record<View, Array<[string,string,string,string,IconName]>> = {
  all:[["Lots traités","1 284","+8,2%","vs période précédente","box"],["Projets à l'heure","87,5%","+3,1%","7 jalons cette semaine","calendar"],["Présence","94,7%","+1,4%","43 sur 47 présents","users"],["Alertes critiques","3","−40%","7 points d'attention","alert"]],
  planning:[["Projets actifs","24","+3","6 équipes mobilisées","grid"],["Jalons à l'heure","87,5%","+3,1%","42 sur 48 validés","check"],["Charge moyenne","82%","−4,0%","Capacité mieux répartie","chart"],["Actions en retard","9","−18%","4 critiques","alert"]],
  trace:[["Lots actifs","1 284","+8,2%","Aujourd'hui","box"],["Conformité","98,4%","+1,6%","Objectif 97%","check"],["Temps de cycle","2h 18","−12 min","Réception → sortie","clock"],["Incidents ouverts","7","−3","3 prioritaires","alert"]],
  rh:[["Collaborateurs","47","+2","4 départements","users"],["Présence","94,7%","+1,4%","43 présents","check"],["Heures formation","186 h","+24%","Ce trimestre","trend"],["Congés à venir","8","+2","Sur 30 jours","calendar"]]
};

const chartData: Record<View, number[]> = { all:[62,71,66,79,74,88,82,91,84,93,89,96], planning:[58,64,61,72,69,77,75,83,81,89,86,92], trace:[70,76,73,85,80,89,86,94,91,96,93,98], rh:[75,78,76,83,81,86,84,90,88,94,91,95] };
const details = {
  all:{chart:"Performance consolidée",health:"Santé globale",healthLabel:"score global",activity:[["Contrôle qualité validé","Lot LT-2847","Il y a 8 min","check"],["Planning mis à jour","Projet Atlas · Équipe A","Il y a 24 min","calendar"],["Nouveau collaborateur ajouté","Ahmed Ben Youssef","Il y a 51 min","users"]],alerts:[["Critique","Température hors plage","Ligne 02 · À traiter immédiatement","12 min"],["Important","Capacité sous l'objectif","Équipe du soir · 82% de capacité","48 min"],["Information","Validation en attente","Action assignée à Sarra Trabelsi","2 h"]],goal:["Progression globale","84%","1 284","1 520 unités"]},
  planning:{chart:"Respect des jalons",health:"Santé des projets",healthLabel:"projets maîtrisés",activity:[["Jalon de conception validé","Projet Atlas · Phase 3","Il y a 8 min","check"],["Planning ECR mis à jour","Action ECR-102 · Équipe A","Il y a 24 min","calendar"],["Nouvelle dépendance signalée","Projet Horizon · Lot 4","Il y a 51 min","alert"]],alerts:[["Critique","Jalon dépassé de 3 jours","Projet Atlas · Validation méthodes","12 min"],["Important","Charge équipe supérieure à 90%","Conception · Semaine 31","48 min"],["Information","Arbitrage planning requis","Action assignée à Sarra Trabelsi","2 h"]],goal:["Jalons clôturés","88%","42","48 jalons"]},
  trace:{chart:"Taux de conformité des lots",health:"Maîtrise des flux",healthLabel:"lots conformes",activity:[["Contrôle qualité validé","Lot LT-2847 · Ligne 02","Il y a 8 min","check"],["Lot transféré en production","Lot LT-2841 · Ligne 03","Il y a 24 min","route"],["Lot placé en quarantaine","Lot LT-2829 · Contrôle final","Il y a 51 min","alert"]],alerts:[["Critique","Température hors plage","Lot LT-2829 · Zone de stockage B","12 min"],["Important","Contrôle dimensionnel en attente","Lot LT-2836 · Poste Q4","48 min"],["Information","Document fournisseur requis","Lot LT-2818 · Réception","2 h"]],goal:["Lots conformes","98%","1 284","1 310 lots"]},
  rh:{chart:"Taux de présence",health:"Climat social",healthLabel:"engagement RH",activity:[["Pointage d'équipe consolidé","Production · Équipe matin","Il y a 8 min","users"],["Demande de congé approuvée","Leïla Mansour · 3 jours","Il y a 24 min","calendar"],["Formation sécurité planifiée","12 collaborateurs · Salle A","Il y a 51 min","check"]],alerts:[["Critique","Sous-effectif sur l'équipe du soir","Production · 3 postes à couvrir","12 min"],["Important","Entretiens annuels à finaliser","6 collaborateurs · Avant vendredi","48 min"],["Information","Solde de congé à valider","Dossier de Leïla Mansour","2 h"]],goal:["Entretiens réalisés","84%","42","50 entretiens"]}
} as const;
const days=["01","03","05","07","09","11","13","15","17","19","21","23"];
const viewPaths:Record<View,string>={all:"/",planning:"/plannings",trace:"/tracabilite",rh:"/rh"};

function MiniSpark({data}:{data:number[]}) { return <div className="mini-spark">{data.map((n,i)=><i key={i} style={{height:`${Math.max(18,n-45)}%`}} />)}</div> }
function Ring({value,label}:{value:number,label:string}) { return <div className="ring" style={{"--ring":`${value*3.6}deg`} as React.CSSProperties}><div><b>{value}%</b><span>{label}</span></div></div> }

export default function Dashboard({initialView="all"}:{initialView?:View}) {
  const [view,setView]=useState<View>(initialView);
  const [range,setRange]=useState("30 jours");
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("view");if(requested&&requested in views)setView(requested as View)},[]);
  const openView=(next:View)=>{setView(next);window.history.pushState({view:next},"",viewPaths[next])};
  const cfg=views[view]; const data=chartData[view]; const detail=details[view];
  const line=useMemo(()=>data.map((v,i)=>`${i/(data.length-1)*100},${100-(v-50)*1.6}`).join(" "),[data]);
  const barLabels=view==="planning"?["Conception","Méthodes","Production","Qualité"]:view==="rh"?["Production","Qualité","Logistique","Admin."]:view==="trace"?["Réception","Production","Contrôle","Expédition"]:["Traçabilité","Planning","RH","Qualité"];
  const barVals=view==="planning"?[92,78,84,68]:view==="rh"?[90,90,92,100]:view==="trace"?[96,83,72,58]:[94,88,95,84];
  return <main className={`app theme-${cfg.color}`}>
    <aside className="rail">
      <a className="logo" href="#" aria-label="SAGE 360"><img src="/sage-logo.png" alt="Logo SAGE Automotive Interiors"/><span>SAGE 360</span></a>
      <nav>
        <p>ESPACE DE PILOTAGE</p>
        {(Object.keys(views) as View[]).map((key)=><button key={key} onClick={()=>openView(key)} className={view===key?"active":""}><span>{icons[key==="all"?"grid":key==="planning"?"calendar":key==="trace"?"route":"users"]}</span><b>{views[key].label}</b>{key==="all"&&<em>4</em>}</button>)}
        <p>ANALYSE</p><button><span>{icons.chart}</span><b>Rapports</b></button><button><span>{icons.clock}</span><b>Historique</b></button>
      </nav>
      <div className="sync"><span><i/> Systèmes synchronisés</span><b>3 / 3</b><small>Mise à jour il y a 2 min</small></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="mobile-brand"><img src="/sage-logo.png" alt=""/><b>SAGE 360</b></div><label className="search"><span>{icons.search}</span><input aria-label="Rechercher" placeholder="Rechercher un lot, un projet, un collaborateur…"/><kbd>⌘ K</kbd></label><div className="top-actions"><button className="round">{icons.bell}<i>3</i></button><div className="person"><span>KT</span><p><b>Kamel Tounsi</b><small>Responsable opérations</small></p><em>⌄</em></div></div></header>
      <div className="page">
        <div className="headline"><div><div className="breadcrumb">PILOTAGE <span>/</span> {cfg.label.toUpperCase()}</div><h1>{cfg.title}</h1><p>{cfg.subtitle}</p></div><div className="actions"><button>{icons.download} Exporter</button><select value={range} onChange={e=>setRange(e.target.value)} aria-label="Période"><option>7 jours</option><option>30 jours</option><option>Ce trimestre</option></select></div></div>
        <div className="view-switch" role="tablist">{(Object.keys(views) as View[]).map(key=><button role="tab" aria-selected={view===key} className={view===key?"active":""} onClick={()=>openView(key)} key={key}><span>{icons[key==="all"?"grid":key==="planning"?"calendar":key==="trace"?"route":"users"]}</span>{views[key].short}</button>)}</div>
        <section className="kpi-grid">{kpis[view].map((k,i)=><article className="kpi" key={k[0]}><div className="kpi-icon">{icons[k[4]]}</div><div className="delta">{k[2]}</div><small>{k[0]}</small><strong>{k[1]}</strong><footer><span>{k[3]}</span><MiniSpark data={data.slice(i,i+6).concat(data.slice(0,i))}/></footer></article>)}</section>
        <section className="grid-main">
          <article className="card performance"><div className="card-head"><div><span className="overline">{cfg.status}</span><h2>{detail.chart}</h2><p>Comparaison avec la période précédente</p></div><div className="legend"><span><i/>Actuel</span><span><i/>Précédent</span></div></div><div className="score"><strong>{cfg.score}</strong><em>↗ +4,6%</em></div><div className="line-chart"><div className="y-axis"><span>100</span><span>90</span><span>80</span><span>70</span><span>60</span></div><div className="plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Courbe de performance"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".25"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${line} 100,100`} fill="url(#fill)"/><polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><div className="x-axis">{days.map(d=><span key={d}>{d}</span>)}</div></div></div></article>
          <article className="card health"><div className="card-head"><div><span className="overline">SYNTHÈSE</span><h2>{detail.health}</h2><p>Indicateurs clés du jour</p></div><button>•••</button></div><Ring value={view==="trace"?98:view==="planning"?88:view==="rh"?94:93} label={detail.healthLabel}/><div className="health-list"><div><span className="dot green"/>Optimal <b>6</b></div><div><span className="dot amber"/>À surveiller <b>3</b></div><div><span className="dot red"/>Critique <b>1</b></div></div></article>
          <article className="card distribution"><div className="card-head"><div><span className="overline">RÉPARTITION</span><h2>{view==="rh"?"Présence par département":view==="planning"?"Avancement par équipe":view==="trace"?"Flux des lots":"Performance par application"}</h2><p>Valeurs consolidées en temps réel</p></div><button>Voir le détail →</button></div><div className="h-bars">{barLabels.map((label,i)=><div key={label}><p><b>{label}</b><span>{barVals[i]}%</span></p><i><b style={{width:`${barVals[i]}%`}}/></i><small>{Math.round(barVals[i]*.47)} / 47</small></div>)}</div></article>
          <article className="card activity"><div className="card-head"><div><span className="overline">EN DIRECT</span><h2>Activité récente</h2><p>Dernières opérations enregistrées</p></div><span className="live"><i/> LIVE</span></div><div className="timeline">{detail.activity.map((a,i)=><div key={i}><span className={`event e${i}`}>{icons[a[3] as IconName]}</span><p><b>{a[0]}</b><small>{a[1]}</small></p><time>{a[2]}</time></div>)}</div><button className="full">Voir toute l'activité <span>→</span></button></article>
        </section>
        <section className="lower-grid"><article className="card alerts"><div className="card-head"><div><span className="overline">PRIORITÉS</span><h2>Alertes nécessitant votre attention</h2></div><button>Tout afficher</button></div>{detail.alerts.map((a,i)=><div className="alert-row" key={a[1]}><span className={`severity s${i}`}>{i?"!":"!!"}</span><p><em>{a[0]}</em><b>{a[1]}</b><small>{a[2]}</small></p><time>{a[3]}</time><button>→</button></div>)}</article><article className="card goal"><div className="card-head"><div><span className="overline">OBJECTIF MENSUEL</span><h2>{detail.goal[0]}</h2></div><b>Juillet</b></div><div className="goal-number"><strong>{detail.goal[1]}</strong><span>{detail.goal[2]} <small>/ {detail.goal[3]}</small></span></div><i className="goal-bar"><b style={{width:detail.goal[1]}}/></i><div className="goal-foot"><span><i className="dot green"/>Dans les temps</span><b>6 jours restants</b></div></article></section>
        <footer className="page-foot"><span><i/> Données synchronisées il y a 2 min</span><p>SAGE 360 · Centre de pilotage unifié</p><button>↻ Actualiser</button></footer>
      </div>
    </section>
  </main>
}


