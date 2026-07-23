import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

const traceEvents = [
  { time: "09:42", title: "Lot LT-2841 contrôlé", meta: "Ligne 03 · Conforme", tone: "emerald" },
  { time: "08:17", title: "Expédition EXP-0917 validée", meta: "Quai B · Client Carthage", tone: "blue" },
  { time: "Hier", title: "Alerte température résolue", meta: "Chambre froide 02 · 18 min", tone: "amber" },
];

const absences = [
  { day: "24", month: "JUL", name: "Amine Ben Salem", detail: "Congé annuel · 3 jours", avatar: "AB" },
  { day: "29", month: "JUL", name: "Sarra Trabelsi", detail: "Formation qualité · 1 jour", avatar: "ST" },
];

export default async function Home() {
  const authenticatedUser = await getChatGPTUser();
  const user = authenticatedUser ?? {
    displayName: "Kamel Tounsi",
    email: "kamel.tounsi@sage-index.tn",
    fullName: "Kamel Tounsi",
  };
  const firstName = user.displayName.split(" ")[0] || "Kamel";
  const hasTraceabilityAccount = true;
  const hasHrAccount = true;
  const hasBothAccounts = hasTraceabilityAccount && hasHrAccount;

  return (
    <main className="shell">
      {!authenticatedUser && (
        <div className="demo-bar">
          <span>Mode aperçu — connectez-vous pour afficher vos données réelles.</span>
          <a href={chatGPTSignInPath("/")}>Se connecter</a>
        </div>
      )}

      <header className="topbar">
        <a className="brand" href="#" aria-label="Sage Index — accueil">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><b>SAGE</b><small>INDEX</small></span>
        </a>
        <div className="header-actions">
          <button className="icon-button" aria-label="Rechercher">⌕</button>
          <button className="icon-button notification" aria-label="Notifications">♢<i>3</i></button>
          <span className="divider" />
          <div className="profile">
            <span className="avatar">KT</span>
            <span className="profile-copy"><b>{user.displayName}</b><small>Responsable opérations</small></span>
            <span className="chevron">⌄</span>
          </div>
          {authenticatedUser && <a className="logout" href={chatGPTSignOutPath("/")}>Déconnexion</a>}
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav aria-label="Navigation principale">
            <a className="nav-item active" href="#"><span>⌂</span>Vue d’ensemble</a>
            <p>ESPACE DE TRAVAIL</p>
            <a className="nav-item" href="#activite"><span>◫</span>Activité</a>
            <a className="nav-item" href="#equipe"><span>♙</span>Mon équipe</a>
            <a className="nav-item" href="#documents"><span>▱</span>Documents</a>
            <p>OUTILS</p>
            <a className="nav-item" href="#rapports"><span>▥</span>Rapports</a>
            <a className="nav-item" href="#parametres"><span>⚙</span>Paramètres</a>
          </nav>
          <div className="support-card">
            <span>?</span>
            <b>Besoin d’aide ?</b>
            <small>Notre équipe vous répond</small>
            <button>Contacter le support</button>
          </div>
        </aside>

        <section className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">JEUDI 23 JUILLET</p>
              <h1>Bonjour {firstName} <span>👋</span></h1>
              <p>Voici l’essentiel de votre activité aujourd’hui.</p>
            </div>
            <button className="period">30 derniers jours <span>⌄</span></button>
          </div>

          <section className="access-grid" aria-label="Accès aux applications">
            <article className="app-card trace">
              <div className="app-card-head">
                <span className="app-icon">⌁</span>
                <span className="status"><i /> OPÉRATIONNEL</span>
              </div>
              <div>
                <small>APPLICATION</small>
                <h2>Traçabilité</h2>
                <p>Suivez vos lots, contrôles qualité et expéditions en temps réel.</p>
              </div>
              <div className="app-meta"><span><b>98,4%</b><small>Taux de conformité</small></span><span><b>12</b><small>Lots en cours</small></span></div>
              {hasBothAccounts && <a href="/tracabilite">Accéder à Traçabilité <span>→</span></a>}
            </article>

            <article className="app-card hr">
              <div className="app-card-head">
                <span className="app-icon">♙</span>
                <span className="status"><i /> À JOUR</span>
              </div>
              <div>
                <small>APPLICATION</small>
                <h2>Ressources Humaines</h2>
                <p>Gérez vos équipes, absences et documents collaborateurs.</p>
              </div>
              <div className="app-meta"><span><b>47</b><small>Collaborateurs</small></span><span><b>4</b><small>Absents aujourd’hui</small></span></div>
              {hasBothAccounts && <a href="/rh">Accéder aux RH <span>→</span></a>}
            </article>
          </section>

          <section className="metrics">
            <article><span className="metric-icon blue">◫</span><div><small>LOTS TRAITÉS</small><b>1 284</b><p><i className="up">↗ 8,2%</i> vs. période préc.</p></div></article>
            <article><span className="metric-icon violet">♙</span><div><small>TAUX DE PRÉSENCE</small><b>94,7%</b><p><i className="up">↗ 1,4%</i> vs. période préc.</p></div></article>
            <article><span className="metric-icon amber">!</span><div><small>POINTS D’ATTENTION</small><b>7</b><p><i className="down">↘ 3</i> depuis hier</p></div></article>
            <article><span className="metric-icon green">✓</span><div><small>ACTIONS TERMINÉES</small><b>36</b><p><i className="up">↗ 12,5%</i> ce mois-ci</p></div></article>
          </section>

          <section className="lower-grid">
            <article className="panel activity-panel" id="activite">
              <div className="panel-title"><div><h3>Activité récente</h3><p>Événements issus de vos deux applications</p></div><a href="#">Tout voir →</a></div>
              <div className="timeline">
                {traceEvents.map((event) => (
                  <div className="event" key={event.title}>
                    <time>{event.time}</time><span className={`event-dot ${event.tone}`}>✓</span>
                    <div><b>{event.title}</b><small>{event.meta}</small></div><span className="more">•••</span>
                  </div>
                ))}
                <div className="event"><time>Hier</time><span className="event-dot violet">♙</span><div><b>Nouveau collaborateur ajouté</b><small>Mehdi Ayari · Production</small></div><span className="more">•••</span></div>
              </div>
            </article>

            <article className="panel" id="equipe">
              <div className="panel-title"><div><h3>Prochaines absences</h3><p>À anticiper dans votre équipe</p></div><a href="#">Calendrier →</a></div>
              <div className="absence-list">
                {absences.map((absence) => (
                  <div className="absence" key={absence.name}>
                    <span className="date"><b>{absence.day}</b><small>{absence.month}</small></span>
                    <span className="avatar small">{absence.avatar}</span>
                    <div><b>{absence.name}</b><small>{absence.detail}</small></div>
                  </div>
                ))}
              </div>
              <button className="request-button">+ Nouvelle demande d’absence</button>
            </article>
          </section>
          <footer><span>Données synchronisées il y a 2 min</span><button>↻ Actualiser</button></footer>
        </section>
      </div>
    </main>
  );
}
