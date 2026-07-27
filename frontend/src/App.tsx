import { FormEvent, useEffect, useMemo, useState } from 'react';

type Dashboard = {
  user: { name: string; department: string; jobTitle: string; username: string; matricule: string; manager: boolean };
  applications: { code: string; label: string; hasAccount: boolean; url: string; identifier?: string; role?: string; email?: string }[];
  metrics: { lotsProcessed?: number; attendanceRate?: number | null; attentionPoints?: number; completedActions?: number };
  traceability: { lotsToday?: number; pendingControls?: number; nonConformities?: number; shipmentsReady?: number | null; lastUpdate?: string | null; available?: boolean };
  hr: { presenceStatus?: string; leaveBalance?: number | null; pendingRequests?: number; teamAbsences?: number; nextEvent?: string; available?: boolean };
  planning: { totalActions?: number; openActions?: number; lateActions?: number; completedActions?: number; activeProjects?: number; completionRate?: number | null; available?: boolean };
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
};

type DataRow = Record<string, string | number>;
type DashboardView = 'ALL' | 'TRACEABILITY' | 'HR' | 'PLANNING';
type OperationalData = {
  generatedAt: string;
  traceability: { connected: boolean; totals: DataRow; dailyEvents: DataRow[]; eventTypes: DataRow[]; projects: DataRow[]; stockByStatus: DataRow[]; topParts: DataRow[]; recentActivity: DataRow[] };
  hr: { connected: boolean; totals: DataRow; dailyPresence: DataRow[]; departments: DataRow[]; shifts: DataRow[]; productionLines: DataRow[]; overtime: DataRow[]; absenceReasons: DataRow[] };
  planning: { connected: boolean; totals: DataRow; status: DataRow[]; stages: DataRow[] };
};

const n = (value: string | number | null | undefined) => Number(value ?? 0);
const fmt = (value: string | number | undefined) => n(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const personalValue = (value: string | number | null | undefined) => value == null ? 'â€”' : value;

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
  const [token, setToken] = useState(() => sessionStorage.getItem('portal-token') ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [ssoLaunching, setSsoLaunching] = useState(false);
  const [dashboardView, setDashboardView] = useState<DashboardView>('ALL');

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
    if (data.user.username === 'admin') {
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
    if (!token || dashboard) return;
    loadDashboard(token).catch(() => {
      sessionStorage.removeItem('portal-token');
      setToken('');
      setError('Votre session a expirÃ©. Reconnectez-vous.');
    });
  }, [token, dashboard]);

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
      setToken(session.accessToken);
      await loadDashboard(session.accessToken);
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
    setDashboard(null);
    setAccounts([]);
    setOperational(null);
    setPassword('');
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
    setPasswordMessage('Mot de passe modifiÃ©. Reconnexion requiseâ€¦');
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
      setError('Impossible dâ€™ouvrir la session unifiÃ©e. RÃ©essayez dans quelques instants.');
    } finally { setSsoLaunching(false); }
  }

  if (!dashboard) {
    return (
      <main className="login-page">
        <section className="login-aside">
          <Brand />
          <div className="pitch">
            <span className="pill">PORTAIL UNIFIÃ‰</span>
            <h1>Une seule connexion.<br /><em>Toute votre activitÃ©.</em></h1>
            <p>Retrouvez la traÃ§abilitÃ©, les ressources humaines et la gestion des plannings dans un espace personnalisÃ©, fiable et sÃ©curisÃ©.</p>
          </div>
          <div className="aside-footer"><span>TraÃ§abilitÃ©</span><i /><span>Ressources Humaines</span><i /><span>Gestion des plannings</span></div>
        </section>

        <section className="login-panel">
          <form onSubmit={submit}>
            <p className="eyebrow">BIENVENUE</p>
            <h2>Connectez-vous</h2>
            <p className="sub">AccÃ©dez Ã  votre espace SAGE 360</p>

            <label htmlFor="matricule">Matricule</label>
            <input id="matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)}
              inputMode="numeric" autoComplete="username" placeholder="Votre matricule" required autoFocus />

            <label htmlFor="password">Mot de passe</label>
            <input id="password" value={password} onChange={(e) => setPassword(e.target.value)}
              type="password" autoComplete="current-password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" required />

            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={loading}>
              <span>{loading ? 'Connexionâ€¦' : 'Se connecter'}</span><span aria-hidden>â†’</span>
            </button>
            <p className="help">Ã€ la premiÃ¨re connexion, votre mot de passe est votre matricule.</p>
          </form>
        </section>
      </main>
    );
  }

  const isAdmin = dashboard.user.username === 'admin';
  const availableApps = dashboard.applications.filter((app) => app.hasAccount);
  const planningCompletion = Math.max(0, Math.min(100, n(dashboard.planning?.completionRate)));
  const attentionTotal = n(dashboard.metrics.attentionPoints) + n(dashboard.planning?.lateActions);
  const isView = (code: Exclude<DashboardView, 'ALL'>) => dashboardView === 'ALL' || dashboardView === code;
  const viewTitle = dashboardView === 'TRACEABILITY' ? 'Dashboard TraÃ§abilitÃ©'
    : dashboardView === 'HR' ? 'Dashboard Ressources Humaines'
    : dashboardView === 'PLANNING' ? 'Dashboard Gestion des plannings'
    : 'Centre de pilotage unifiÃ©';
  return (
    <>
      <header className="topbar">
        <Brand />
        <div className="profile">
          <span className="avatar">{dashboard.user.name.slice(0, 2)}</span>
          <span><b>{dashboard.user.name}</b><small>{dashboard.user.jobTitle}</small></span>
          {dashboard.user.username !== 'admin' && <button onClick={() => setShowPassword(true)}>Mot de passe</button>}
          <button onClick={logout}>DÃ©connexion</button>
        </div>
      </header>
      <div className="workspace">
        <aside><nav><button className={dashboardView === 'ALL' ? 'active' : ''} onClick={() => setDashboardView('ALL')}>âŒ‚ <span>Vue globale</span></button><p>APPLICATIONS</p><button className={dashboardView === 'PLANNING' ? 'active' : ''} onClick={() => setDashboardView('PLANNING')}>â–¦ <span>Plannings</span></button><button className={dashboardView === 'TRACEABILITY' ? 'active' : ''} onClick={() => setDashboardView('TRACEABILITY')}>â—‡ <span>TraÃ§abilitÃ©</span></button><button className={dashboardView === 'HR' ? 'active' : ''} onClick={() => setDashboardView('HR')}>â™™ <span>Ressources humaines</span></button>{isAdmin && <><p>ADMINISTRATION</p><button>âš™ <span>Comptes utilisateurs</span></button></>}</nav></aside>
        <main className={`dashboard view-${dashboardView.toLowerCase()}`}>
          <section className="welcome">
            <div><p className="eyebrow">{viewTitle.toUpperCase()}</p><h1>{dashboardView === 'ALL' ? `Bonjour ${dashboard.user.name.split(' ')[0]} ðŸ‘‹` : viewTitle}</h1><p>{dashboardView === 'ALL' ? `${dashboard.user.department} Â· ${dashboard.user.jobTitle}` : `Indicateurs et activitÃ© dÃ©diÃ©s Â· ${dashboard.user.name}`}</p></div>
            <div className="welcome-meta"><span className="sync">â— 3 sources synchronisÃ©es</span><small>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</small></div>
          </section>
          <section className="dashboard-switcher" aria-label="Choisir le dashboard">
            {([['ALL','Vue globale'],['PLANNING','Planning'],['TRACEABILITY','TraÃ§abilitÃ©'],['HR','Ressources humaines']] as [DashboardView,string][]).map(([code,label]) => <button key={code} className={dashboardView === code ? 'active' : ''} onClick={() => setDashboardView(code)}>{label}</button>)}
          </section>
          {!isAdmin && dashboardView === 'ALL' && availableApps.length > 1 && <button className="launch-all" onClick={() => launchSso()} disabled={ssoLaunching}><span>âœ¦</span><b>{ssoLaunching ? 'Ouverture sÃ©curisÃ©eâ€¦' : `Ouvrir mes ${availableApps.length} applications`}</b><small>Une seule connexion Â· aucun mot de passe redemandÃ©</small><strong>â†’</strong></button>}
          {!isAdmin && dashboardView === 'ALL' && <section className="command-center">
            <div className="command-copy">
              <span className="command-kicker">VOTRE JOURNÃ‰E EN UN COUP Dâ€™Å’IL</span>
              <h2>{attentionTotal > 0 ? `${attentionTotal} point${attentionTotal > 1 ? 's' : ''} mÃ©rite${attentionTotal > 1 ? 'nt' : ''} votre attention` : 'Tout est sous contrÃ´le'}</h2>
              <p>Une lecture croisÃ©e de vos opÃ©rations, de votre situation RH et de vos engagements ECR.</p>
              <div className="source-pills">{availableApps.map((app) => <span key={app.code}>â— {app.label}</span>)}</div>
            </div>
            <div className="command-score">
              <div className="score-ring" style={{ '--score': `${Math.max(12, 100 - Math.min(attentionTotal * 8, 88))}%` } as React.CSSProperties}><b>{Math.max(12, 100 - Math.min(attentionTotal * 8, 88))}</b><span>indice focus</span></div>
            </div>
            <div className="command-kpis">
              <div><span className="kpi-symbol blue">â—‡</span><p><small>ACTIONS DU JOUR</small><b>{fmt(dashboard.traceability.lotsToday)}</b></p></div>
              <div><span className="kpi-symbol violet">â™™</span><p><small>PRÃ‰SENCE</small><b>{dashboard.hr.presenceStatus || 'â€”'}</b></p></div>
              <div><span className="kpi-symbol teal">â–¦</span><p><small>ACTIONS ECR OUVERTES</small><b>{fmt(dashboard.planning?.openActions)}</b></p></div>
              <div><span className="kpi-symbol amber">!</span><p><small>PRIORITÃ‰S</small><b>{attentionTotal}</b></p></div>
            </div>
          </section>}
          <section className="app-grid">
            {availableApps.filter((app) => dashboardView === 'ALL' || app.code === dashboardView).map((app) => (
              <article className={`app-card ${app.code.toLocaleLowerCase()}`} key={app.code}>
                <span className="status">â— COMPTE ACTIF</span><small>APPLICATION</small><h2>{app.label}</h2>
                <p>{app.code === 'HR'
                  ? 'Ã‰quipes, absences et documents collaborateurs.'
                  : app.code === 'PLANNING'
                    ? 'Projets, modifications ECR, jalons et actions planifiÃ©es.'
                    : 'Lots, contrÃ´les qualitÃ© et expÃ©ditions en temps rÃ©el.'}</p>
                <dl className="access-data">
                  <div><dt>Identifiant</dt><dd>{app.identifier || dashboard.user.matricule}</dd></div>
                  {app.email && <div><dt>E-mail</dt><dd>{app.email}</dd></div>}
                  {app.role && <div><dt>RÃ´le</dt><dd>{app.role}</dd></div>}
                  <div><dt>Mot de passe</dt><dd>Votre mot de passe personnel</dd></div>
                </dl>
                <a href={app.url} onClick={(event) => { event.preventDefault(); launchSso(app.code); }}>AccÃ©der sans se reconnecter <b>â†’</b></a>
              </article>
            ))}
          </section>
          {isAdmin && <section className="metrics">
            <article><span>â—«</span><small>LOTS EN BASE</small><b>{operational ? fmt(operational.traceability.totals.batches) : 'â€”'}</b></article>
            <article><span>â™™</span><small>COLLABORATEURS ACTIFS</small><b>{operational ? fmt(operational.hr.totals.employees) : 'â€”'}</b></article>
            <article><span>!</span><small>ANOMALIES OUVERTES</small><b>{operational ? fmt(operational.traceability.totals.openissues) : 'â€”'}</b></article>
            <article><span>âœ“</span><small>POINTAGES ANALYSÃ‰S</small><b>{operational ? fmt(operational.hr.totals.attendancerecords) : 'â€”'}</b></article>
          </section>}
          {operational && <section className="analytics">
            <div className="source-health">
              <span className={operational.traceability.connected ? 'online' : 'offline'}>â— TraÃ§abilitÃ© {operational.traceability.connected ? 'connectÃ©e' : 'indisponible'}</span>
              <span className={operational.hr.connected ? 'online' : 'offline'}>â— RH {operational.hr.connected ? 'connectÃ©e' : 'indisponible'}</span>
              <span className={operational.planning.connected ? 'online' : 'offline'}>â— Plannings {operational.planning.connected ? 'connectÃ©e' : 'indisponible'}</span>
              <small>Extraction rÃ©elle Â· {new Date(operational.generatedAt).toLocaleString('fr-FR')}</small>
            </div>
            <div className="chart-grid">
              <article className="chart-card wide"><header><div><small>TRAÃ‡ABILITÃ‰</small><h2>Ã‰vÃ©nements sur 14 jours</h2></div><span className="chart-legend">â–  RÃ©ceptionsã€€<span>â–  Consommations</span></span></header><Bars rows={operational.traceability.dailyEvents} value="receptions" secondary="consumptions" /></article>
              <article className="chart-card"><header><div><small>TRAÃ‡ABILITÃ‰</small><h2>Types dâ€™Ã©vÃ©nements</h2></div></header><RankedBars rows={operational.traceability.eventTypes} /></article>
              <article className="chart-card"><header><div><small>STOCK</small><h2>QuantitÃ©s rÃ©elles</h2></div></header><div className="stock-gauge"><div style={{ '--fill': `${n(operational.traceability.totals.remainingquantity) / Math.max(1, n(operational.traceability.totals.receivedquantity)) * 100}%` } as React.CSSProperties}><b>{fmt(operational.traceability.totals.remainingquantity)}</b><span>restant sur {fmt(operational.traceability.totals.receivedquantity)}</span></div></div></article>
              <article className="chart-card wide"><header><div><small>RESSOURCES HUMAINES</small><h2>PrÃ©sences et absences sur 14 jours</h2></div><span className="chart-legend">â–  PrÃ©sentsã€€<span>â–  Absents</span></span></header><Bars rows={operational.hr.dailyPresence} value="present" secondary="absent" /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Effectif par dÃ©partement</h2></div></header><RankedBars rows={operational.hr.departments} value="total" /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>RÃ©partition par shift</h2></div></header><RankedBars rows={operational.hr.shifts} /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Lignes de production</h2></div></header><RankedBars rows={operational.hr.productionLines} /></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Motifs dâ€™absence Â· 30 jours</h2></div></header><RankedBars rows={operational.hr.absenceReasons} /></article>
              <article className="chart-card wide"><header><div><small>TRAÃ‡ABILITÃ‰</small><h2>Principales rÃ©fÃ©rences en stock</h2></div></header><div className="parts-table"><div><b>RÃ©fÃ©rence</b><b>Lots</b><b>ReÃ§u</b><b>Restant</b></div>{operational.traceability.topParts.map((row) => <div key={row.label}><strong>{row.label}</strong><span>{fmt(row.batches)}</span><span>{fmt(row.received)}</span><span>{fmt(row.remaining)}</span></div>)}</div></article>
              <article className="chart-card"><header><div><small>RH</small><h2>Heures supplÃ©mentaires</h2></div></header><Bars rows={operational.hr.overtime} value="value" /></article>
              <article className="chart-card wide planning-chart"><header><div><small>GESTION DES PLANNINGS</small><h2>RÃ©partition des actions ECR</h2></div><span className="chart-legend teal-text">â–  Workflow actif</span></header><RankedBars rows={operational.planning.status} /></article>
              <article className="chart-card"><header><div><small>PLANNINGS</small><h2>Portefeuille ECR</h2></div></header><div className="planning-totals"><b>{fmt(operational.planning.totals.projects)}</b><span>projets actifs</span><div><strong>{fmt(operational.planning.totals.actions)}</strong> actions</div><div className="late"><strong>{fmt(operational.planning.totals.lateactions)}</strong> en retard</div></div></article>
            </div>
          </section>}
          {!isAdmin && <section className="summary-grid">
            {isView('TRACEABILITY') && <article className="summary-card trace-summary">
              <div className="panel-title"><div><p className="eyebrow">TRAÃ‡ABILITÃ‰</p><h2>Mon activitÃ© opÃ©rationnelle</h2></div><a href="http://localhost:5173/">Ouvrir â†’</a></div>
              <div className="summary-values">
                <div><b>{personalValue(dashboard.traceability.lotsToday)}</b><span>Actions aujourd'hui</span></div>
                <div><b>{personalValue(dashboard.traceability.pendingControls)}</b><span>Anomalies ouvertes</span></div>
                <div className={dashboard.traceability.nonConformities ? 'attention' : ''}><b>{personalValue(dashboard.traceability.nonConformities)}</b><span>Non-conformitÃ©s</span></div>
                <div><b>{personalValue(dashboard.traceability.shipmentsReady)}</b><span>ExpÃ©ditions prÃªtes</span></div>
              </div>
              <small className="updated">DerniÃ¨re mise Ã  jour : {dashboard.traceability.lastUpdate ? new Date(dashboard.traceability.lastUpdate).toLocaleString('fr-FR') : 'aucune activitÃ©'}</small>
            </article>}
            {isView('HR') && <article className="summary-card hr-summary">
              <div className="panel-title"><div><p className="eyebrow">RESSOURCES HUMAINES</p><h2>{dashboard.user.manager ? 'Mon Ã©quipe & moi' : 'Ma situation RH'}</h2></div><a href="http://localhost:5170/">Ouvrir â†’</a></div>
              <div className="summary-values">
                <div><b className="present">â— {personalValue(dashboard.hr.presenceStatus)}</b><span>Statut du jour</span></div>
                <div><b>{personalValue(dashboard.hr.leaveBalance)}</b><span>Jours de congÃ©</span></div>
                <div><b>{personalValue(dashboard.hr.pendingRequests)}</b><span>Demandes en attente</span></div>
                {dashboard.user.manager && <div><b>{personalValue(dashboard.hr.teamAbsences)}</b><span>Absences Ã©quipe</span></div>}
              </div>
              <small className="updated">{dashboard.hr.nextEvent}</small>
            </article>}
            {isView('PLANNING') && dashboard.applications.some((app) => app.code === 'PLANNING' && app.hasAccount) && <article className="summary-card planning-summary">
              <div className="panel-title"><div><p className="eyebrow">GESTION DES PLANNINGS</p><h2>Mes engagements ECR</h2></div><a href="http://localhost:3000/">Ouvrir â†’</a></div>
              <div className="planning-overview">
                <div className="mini-ring" style={{ '--score': `${planningCompletion}%` } as React.CSSProperties}><b>{planningCompletion}%</b><span>rÃ©alisÃ©</span></div>
                <div className="planning-stats"><div><b>{personalValue(dashboard.planning.activeProjects)}</b><span>Projets actifs</span></div><div><b>{personalValue(dashboard.planning.openActions)}</b><span>Actions ouvertes</span></div><div className={dashboard.planning.lateActions ? 'danger' : ''}><b>{personalValue(dashboard.planning.lateActions)}</b><span>En retard</span></div></div>
              </div>
              <div className="progress-track"><i style={{ width: `${planningCompletion}%` }} /></div>
              <small className="updated">{personalValue(dashboard.planning.completedActions)} action(s) finalisÃ©e(s)</small>
            </article>}
          </section>}
          {!isAdmin && dashboardView === 'ALL' && <section className="cross-view">
            <article className="cross-chart">
              <div className="panel-title"><div><p className="eyebrow">VISION CROISÃ‰E</p><h2>Charge & attention par application</h2></div><span className="live-chip">TEMPS RÃ‰EL</span></div>
              <div className="cross-bars">
                {[
                  ['TraÃ§abilitÃ©', n(dashboard.traceability.pendingControls), '#3973df'],
                  ['Ressources humaines', n(dashboard.hr.pendingRequests), '#655bd3'],
                  ['Gestion des plannings', n(dashboard.planning?.lateActions), '#1f9b8f'],
                ].map(([label, value, color]) => <div key={String(label)}><span>{label}<b>{value}</b></span><i><em style={{ width: `${Math.max(Number(value) ? 12 : 2, Number(value) / Math.max(1, attentionTotal) * 100)}%`, background: String(color) }} /></i></div>)}
              </div>
            </article>
            <article className="focus-card">
              <span className="focus-icon">âœ¦</span><p className="eyebrow">RECOMMANDATION</p><h2>{n(dashboard.planning?.lateActions) > 0 ? 'Commencez par le planning ECR' : n(dashboard.traceability.pendingControls) > 0 ? 'Priorisez les anomalies qualitÃ©' : 'Planifiez votre prochaine action'}</h2><p>{attentionTotal > 0 ? 'Le cockpit a identifiÃ© la zone qui concentre le plus de points dâ€™attention aujourdâ€™hui.' : 'Aucune urgence dÃ©tectÃ©e dans vos trois applications.'}</p>
            </article>
          </section>}
          {!isAdmin && <section className="detail-grid">
            <article className="detail-card">
              <div className="panel-title"><div><p className="eyebrow">Ã€ TRAITER</p><h2>Mes prioritÃ©s</h2></div></div>
              {dashboard.priorities.filter((priority) => dashboardView === 'ALL' || (dashboardView === 'HR' ? priority.source === 'RH' : dashboardView === 'PLANNING' ? priority.source === 'Plannings' : priority.source.includes('Tra'))).map((priority) => (
                <a className="priority-row" href={priority.url} key={`${priority.source}-${priority.title}`}>
                  <span className={`priority-dot ${priority.level}`} />
                  <div><b>{priority.title}</b><small>{priority.source} Â· {priority.detail}</small></div><strong>â†’</strong>
                </a>
              ))}
              {dashboard.priorities.length === 0 && <p>Aucune prioritÃ© issue de vos donnÃ©es.</p>}
            </article>
            <article className="detail-card">
              <div className="panel-title"><div><p className="eyebrow">ACTIVITÃ‰</p><h2>DerniÃ¨res informations</h2></div></div>
              {dashboard.recentActivity.map((activity) => (
                <div className="activity-row" key={`${activity.source}-${activity.title}`}>
                  <span>{activity.source === 'RH' ? 'RH' : activity.source === 'Plannings' ? 'PL' : 'TR'}</span>
                  <div><b>{activity.title}</b><small>{activity.source} Â· {activity.time}</small></div>
                </div>
              ))}
              {dashboard.recentActivity.length === 0 && <p>Aucune activitÃ© enregistrÃ©e pour votre compte.</p>}
            </article>
          </section>}
          {isAdmin && (
            <section className="admin-panel">
              <div className="admin-head"><div><p className="eyebrow">ADMINISTRATION</p><h2>Comptes utilisateurs</h2><p>Les employÃ©s de type DIRECT/DIRECTS sont exclus automatiquement.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un employÃ©â€¦" /></div>
              <div className="table-wrap"><table><thead><tr><th>EmployÃ©</th><th>Matricule</th><th>DÃ©partement</th><th>Type</th><th>Statut</th></tr></thead><tbody>
                {filteredAccounts.map((account) => <tr key={account.id}><td><b>{account.fullName}</b><small>{account.jobTitle}</small></td><td>{account.matricule}</td><td>{account.department}</td><td><span className="type">{account.workType}</span></td><td><span className="account-status">{account.accountStatus === 'ACTIVE' ? 'Actif' : 'Ã€ activer'}</span></td></tr>)}
              </tbody></table></div>
            </section>
          )}
        </main>
      </div>
      {showPassword && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPassword(false)}>
        <section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowPassword(false)} aria-label="Fermer">Ã—</button>
          <p className="eyebrow">SÃ‰CURITÃ‰ DU COMPTE</p>
          <h2 id="password-title">Changer le mot de passe</h2>
          <p>Choisissez au moins 8 caractÃ¨res. Toutes les sessions devront Ãªtre reconnectÃ©es.</p>
          <form onSubmit={changePassword}>
            <label>Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus />
            <label>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            <label>Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
            {passwordMessage && <p className="password-message" role="status">{passwordMessage}</p>}
            <div className="modal-actions"><button type="button" onClick={() => setShowPassword(false)}>Annuler</button><button className="save-password">Enregistrer</button></div>
          </form>
        </section>
      </div>}
    </>
  );
}

