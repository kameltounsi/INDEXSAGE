import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

type View = 'ALL' | 'TRACEABILITY' | 'HR' | 'PLANNING';
type Kpi = { label: string; value: string | number; tone: string };
type Source = { label: string; detail: string };
type AssistantPayload = { id: string; createdAt: string; intent: string; confidence: number; title: string; answer: string; cards: Kpi[]; insights: string[]; sources: Source[]; action: { label: string; view: View }; suggestions: string[]; workflow?: string[]; answerType?: string };
type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; payload?: AssistantPayload; failed?: boolean };

const STARTERS: Record<View,string[]> = {
  ALL:['Quelle est ma priorité aujourd’hui ?','Explique le flux transversal RH vers Traçabilité','Compare les risques des trois applications','Quels modules dois-je ouvrir ?'],
  PLANNING:['Explique le workflow d’un dossier ECR','Quelles preuves manquent avant validation ?','Quelles actions sont en retard ?','Comment clôturer une phase ?'],
  HR:['Analyse le risque d’absentéisme','Explique les permutations d’opérateurs','Quelles demandes RH sont en attente ?','Comment fonctionne EDI DELFOR ?'],
  TRACEABILITY:['Explique la consommation en coupe','Comment corriger une consommation ?','Quels signalements sont ouverts ?','Comment fonctionne un regroupement STB ?'],
};

export function PortalAssistant({ token, currentView, userName, username, onNavigate }: { token: string; currentView: View; userName: string; username: string; onNavigate: (view: View) => void }) {
  const storageKey = `sage-assistant:${username}`;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { return []; }
  });
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30))); }, [messages, storageKey]);
  useEffect(() => { if (open) setTimeout(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); inputRef.current?.focus(); }, 50); }, [open, messages, loading]);

  async function ask(text: string) {
    const clean = text.trim(); if (!clean || loading) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: clean, createdAt: new Date().toISOString() };
    setMessages(current => [...current, userMessage]); setInput(''); setLoading(true);
    try {
      const history = [...messages, userMessage].slice(-8).map(item => ({ role: item.role, content: item.content }));
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: clean, currentView, history }) });
      if (!response.ok) throw new Error();
      const payload: AssistantPayload = await response.json();
      setMessages(current => [...current, { id: payload.id, role: 'assistant', content: payload.answer, createdAt: payload.createdAt, payload }]);
    } catch {
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', content: 'Je ne peux pas joindre les sources opérationnelles pour le moment. Réessayez dans quelques instants.', createdAt: new Date().toISOString(), failed: true }]);
    } finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); ask(input); }
  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(input); } }
  function clear() { setMessages([]); localStorage.removeItem(storageKey); }
  function exportConversation() {
    const content = messages.map(item => `[${new Date(item.createdAt).toLocaleString('fr-FR')}] ${item.role === 'user' ? userName : 'SAGE Copilot'}\n${item.content}`).join('\n\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `conversation-sage-${new Date().toISOString().slice(0,10)}.txt`; link.click(); URL.revokeObjectURL(url);
  }

  return <div className={`portal-assistant ${open ? 'is-open' : ''} ${expanded ? 'is-expanded' : ''}`}>
    {!open && <button className="assistant-launcher" onClick={() => setOpen(true)} aria-label="Ouvrir SAGE Copilot"><span>AI</span><i><strong>SAGE Copilot</strong><small>Assistant opérationnel</small></i><b /></button>}
    {open && <section className="assistant-window" role="dialog" aria-label="Assistant SAGE Copilot">
      <header className="assistant-header"><div className="assistant-avatar">AI</div><div><strong>SAGE Copilot</strong><span><i /> Assistant opérationnel actif</span></div><div className="assistant-tools"><button onClick={exportConversation} title="Exporter la conversation" aria-label="Exporter">↓</button><button onClick={clear} title="Nouvelle conversation" aria-label="Nouvelle conversation">↻</button><button onClick={() => setExpanded(value => !value)} title="Agrandir" aria-label="Agrandir">{expanded ? '↙' : '↗'}</button><button onClick={() => setOpen(false)} title="Fermer" aria-label="Fermer">×</button></div></header>
      <div className="assistant-context"><div><span>Contexte actif</span><b>{currentView === 'ALL' ? 'Vue globale' : currentView === 'HR' ? 'Ressources humaines' : currentView === 'PLANNING' ? 'Gestion des plannings' : 'Traçabilité'}</b></div><em><i/> 43 modules métier</em></div>
      <div className="assistant-messages" ref={listRef} aria-live="polite">
        {messages.length === 0 && <div className="assistant-welcome"><div className="welcome-orb"><span>AI</span></div><p>Bonjour {userName.split(' ')[0]}</p><h2>Votre copilote métier.</h2><span>Je connais les modules, règles et processus de Sage RH, Planning ECR et Traçabilité Store. Je transforme leur état en contrôles et prochaines actions.</span><div className="assistant-capabilities"><i>43 modules</i><i>Processus croisés</i><i>Données autorisées</i></div><div className="assistant-starters">{STARTERS[currentView].map((prompt,index) => <button key={prompt} onClick={() => ask(prompt)}><span>{['01','02','03','04'][index]}</span><b>{prompt}</b><i>→</i></button>)}</div></div>}
        {messages.map(message => <article className={`assistant-message ${message.role} ${message.failed ? 'failed' : ''}`} key={message.id}>
          {message.role === 'assistant' && <span className="message-avatar">AI</span>}
          <div className="message-body">{message.role === 'assistant' && message.payload && <div className="answer-meta"><b>{message.payload.title}</b><span>{Math.round(message.payload.confidence * 100)}% confiance</span></div>}<p>{message.content}</p>
            {message.payload && <>
              {message.payload.cards.length > 0 && <div className="assistant-kpis">{message.payload.cards.map(card => <div className={`tone-${card.tone.toLowerCase()}`} key={card.label}><small>{card.label}</small><b>{card.value}</b></div>)}</div>}
              {message.payload.workflow && message.payload.workflow.length > 0 && <div className="assistant-workflow"><strong>Processus recommandé</strong>{message.payload.workflow.map((step,index)=><div key={step}><span>{String(index+1).padStart(2,'0')}</span><p>{step}</p></div>)}</div>}
              {message.payload.insights.length > 0 && <div className="assistant-insights"><strong>Recommandations</strong>{message.payload.insights.map((insight,index) => <p key={insight}><span>{index + 1}</span>{insight}</p>)}</div>}
              <div className="answer-footer"><button onClick={() => { onNavigate(message.payload!.action.view); setOpen(false); }}>{message.payload.action.label} →</button><div className="assistant-sources"><span>Sources :</span>{message.payload.sources.map(source => <i title={source.detail} key={source.label}>{source.label}</i>)}</div></div>
              <div className="followups">{message.payload.suggestions.map(suggestion => <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>
            </>}
            <time>{new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        </article>)}
        {loading && <article className="assistant-message assistant"><span className="message-avatar">AI</span><div className="typing"><i/><i/><i/><span>Analyse croisée des données…</span></div></article>}
      </div>
      <form className="assistant-composer" onSubmit={submit}><div className="composer-field"><textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={keyDown} placeholder="Demandez une synthèse, un risque, une priorité…" rows={1} maxLength={1200}/><span>{input.length}/1200</span></div><button disabled={!input.trim() || loading} aria-label="Envoyer">↑</button><small>SAGE Copilot analyse uniquement les données auxquelles votre compte est autorisé.</small></form>
    </section>}
  </div>;
}
