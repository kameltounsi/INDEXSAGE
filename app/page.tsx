import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

const flow = [
  ["Lun",156,148],["Mar",188,176],["Mer",172,168],["Jeu",214,203],
  ["Ven",198,192],["Sam",136,132],["Dim",112,109],
];
const teams = [
  ["Production",18,20],["Qualité",9,10],["Logistique",11,12],["Administration",5,5],
];
const alerts = [
  ["urgent","Température hors plage","Lot LT-2847 · Chambre froide 02","12 min"],
  ["warning","Contrôle qualité en retard","Lot LT-2839 · Ligne 03","48 min"],
  ["info","Équipe sous capacité cible","Production · Équipe du soir","2 h"],
];

function Spark({ values, tone }: { values:number[]; tone:string }) {
  const max=Math.max(...values);
  return <span className={`spark ${tone}`}>{values.map((v,i)=><i key={i} style={{height:`${v/max*100}%`}} />)}</span>;
}

export default async function Home() {
  const authenticatedUser=await getChatGPTUser();
  const user=authenticatedUser??{displayName:"Kamel Tounsi"};
  const firstName=user.displayName.split(" ")[0]||"Kamel";
  return (
    <main className="shell">
      {!authenticatedUser&&<div className="demo-bar"><span>Mode aperçu — données de démonstration</span><a href={chatGPTSignInPath("/")}>Se connecter</a></div>}
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark"><i/><i/><i/></span><span><b>SAGE</b><small>INDEX</small></span></a>
        <div className="header-actions">
          <label className="search"><span>⌕</span><input aria-label="Rechercher" placeholder="Rechercher un lot, un collaborateur…" /></label>
          <button className="icon-button notification">◌<i>3</i></button>
          <span className="avatar">KT</span><span className="profile-copy"><b>{user.displayName}</b><small>Responsable opérations</small></span>
          {authenticatedUser&&<a className="logout" href={chatGPTSignOutPath("/")}>Déconnexion</a>}
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <nav>
            <a className="nav-item active" href="#overview"><span>⌂</span>Vue d’ensemble</a>
            <p>PILOTAGE</p><a className="nav-item" href="#performance"><span>⌁</span>Performance</a><a className="nav-item" href="#alerts"><span>!</span>Qualité & alertes <i>3</i></a>
            <p>APPLICATIONS</p><a className="nav-item" href="/tracabilite"><span>◇</span>Traçabilité</a><a className="nav-item" href="/rh"><span>♙</span>Ressources humaines</a><a className="nav-item" href="/plannings"><span>▦</span>Gestion des plannings</a>
            <p>OUTILS</p><a className="nav-item" href="#"><span>▥</span>Rapports</a><a className="nav-item" href="#"><span>⚙</span>Paramètres</a>
          </nav>
          <div className="data-health"><div><span>État des données</span><b>Synchronisé</b></div><i><span/></i><small>Dernière mise à jour il y a 2 min</small></div>
        </aside>
        <section className="content" id="overview">
          <div className="welcome">
            <div><p className="eyebrow">VENDREDI 24 JUILLET 2026</p><h1>Bonjour {firstName}, voici votre activité.</h1><p>Une vision consolidée de la traçabilité, des ressources humaines et des plannings.</p></div>
            <div className="welcome-actions"><button className="secondary-button">↓ Exporter</button><button className="period">30 derniers jours <span>⌄</span></button></div>
          </div>
          <section className="hero-kpis">
            <article><div className="kpi-top"><span className="kpi-icon blue">◇</span><em>↗ 8,2%</em></div><small>LOTS TRAITÉS</small><b>1 284</b><div className="kpi-foot"><span>vs. 1 187 précédemment</span><Spark values={[42,55,48,72,65,79,86]} tone="blue"/></div></article>
            <article><div className="kpi-top"><span className="kpi-icon green">✓</span><em>↗ 1,6%</em></div><small>TAUX DE CONFORMITÉ</small><b>98,4%</b><div className="kpi-foot"><span>Objectif fixé à 97%</span><Spark values={[83,87,85,90,93,92,97]} tone="green"/></div></article>
            <article><div className="kpi-top"><span className="kpi-icon violet">♙</span><em>↗ 1,4%</em></div><small>TAUX DE PRÉSENCE</small><b>94,7%</b><div className="kpi-foot"><span>43 sur 47 présents</span><Spark values={[94,91,96,93,95,97,95]} tone="violet"/></div></article>
            <article><div className="kpi-top"><span className="kpi-icon amber">!</span><em className="attention">3 critiques</em></div><small>POINTS D’ATTENTION</small><b>7</b><div className="kpi-foot"><span>−3 depuis hier</span><Spark values={[88,76,70,62,56,50,42]} tone="amber"/></div></article>
          </section>
          <section className="dashboard-grid" id="performance">
            <article className="panel flow-panel">
              <div className="panel-title"><div><span className="tag trace">TRAÇABILITÉ</span><h2>Flux des lots</h2><p>Lots traités et contrôlés cette semaine</p></div><div className="legend"><span><i className="lots"/>Traités</span><span><i className="quality"/>Conformes</span></div></div>
              <div className="flow-chart"><div className="axis"><span>240</span><span>180</span><span>120</span><span>60</span><span>0</span></div><div className="chart-area">
                {flow.map(([day,lots,quality])=><div className="bar-group" key={day}><div className="bars"><i className="bar lots" style={{height:`${Number(lots)/2.4}%`}}><b>{lots}</b></i><i className="bar quality" style={{height:`${Number(quality)/2.4}%`}}/></div><span>{day}</span></div>)}
              </div></div>
              <div className="insight"><span>↗</span><p><b>Pic d’activité jeudi</b><small>214 lots traités, soit 18% au-dessus de la moyenne.</small></p></div>
            </article>
            <article className="panel conformity">
              <div className="panel-title"><div><span className="tag trace">QUALITÉ</span><h2>Conformité globale</h2><p>Répartition des contrôles</p></div><a href="/tracabilite">Détails →</a></div>
              <div className="donut"><div><b>98,4%</b><span>conformes</span></div></div>
              <div className="donut-legend"><div><i className="ok"/><span>Conformes<small>1 263 lots</small></span><b>98,4%</b></div><div><i className="wait"/><span>En attente<small>14 lots</small></span><b>1,1%</b></div><div><i className="bad"/><span>Non conformes<small>7 lots</small></span><b>0,5%</b></div></div>
            </article>
            <article className="panel workforce">
              <div className="panel-title"><div><span className="tag hr">RESSOURCES HUMAINES</span><h2>Présence par département</h2><p>Capacité disponible aujourd’hui</p></div><a href="/rh">Équipe →</a></div>
              <div className="team-list">{teams.map(([name,present,total],i)=><div className="team" key={name}><div><b>{name}</b><span>{present}/{total} présents</span></div><i><b className={`c${i}`} style={{width:`${Number(present)/Number(total)*100}%`}}/></i><strong>{Math.round(Number(present)/Number(total)*100)}%</strong></div>)}</div>
              <div className="capacity"><b>43</b><span>collaborateurs présents<small>Capacité opérationnelle optimale</small></span><em>+2 vs. hier</em></div>
            </article>
            <article className="panel status">
              <div className="panel-title"><div><span className="tag trace">OPÉRATIONS</span><h2>État des lots actifs</h2><p>12 lots actuellement en circulation</p></div></div>
              <div className="funnel">{[["Réceptionnés",12,100],["En production",9,75],["En contrôle",5,42],["Prêts à expédier",3,25]].map(([label,count,width])=><div key={label}><span>{label}</span><i><b style={{width:`${width}%`}}/></i><strong>{count}</strong></div>)}</div>
              <a className="full-link" href="/tracabilite">Voir tous les lots <span>→</span></a>
            </article>
          </section>
          <section className="bottom-grid" id="alerts">
            <article className="panel alerts"><div className="panel-title"><div><h2>Alertes & priorités</h2><p>Actions qui nécessitent votre attention</p></div><button>Toutes ⌄</button></div>
              <div className="alert-list">{alerts.map(([level,title,meta,time])=><div className="alert-row" key={title}><span className={level}>!</span><div><b>{title}</b><small>{meta}</small></div><time>{time}</time><button>→</button></div>)}</div>
            </article>
            <article className="panel absences"><div className="panel-title"><div><h2>Prochaines absences</h2><p>Planning de votre équipe</p></div><a href="/rh">Calendrier →</a></div>
              {[["24","JUL","AB","Amine Ben Salem","Congé annuel · 3 jours"],["29","JUL","ST","Sarra Trabelsi","Formation qualité · 1 jour"],["02","AOÛ","MA","Mehdi Ayari","Congé annuel · 5 jours"]].map(([d,m,initials,name,detail])=><div className="absence" key={name}><span className="date"><b>{d}</b><small>{m}</small></span><span className="avatar">{initials}</span><div><b>{name}</b><small>{detail}</small></div></div>)}
            </article>
          </section>
          <footer><span>Données synchronisées il y a 2 min</span><div><a href="/tracabilite">Traçabilité</a><a href="/rh">Ressources humaines</a><a href="/plannings">Plannings</a><button>↻ Actualiser</button></div></footer>
        </section>
      </div>
    </main>
  );
}
