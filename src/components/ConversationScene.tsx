import { useGameStore } from '../game/store';
import { SCENARIO } from '../game/scenario';
import { PORTRAIT_CLOSED, PORTRAIT_DATA_STATE } from './cinematicPresentation';
import type { PlayerIntent } from '../game/types';
import './ConversationScene.css';

const INTENTIONS: Array<{id:PlayerIntent;label:string;description:string}>= [
  {id:'understand',label:'Understand',description:'Ask and listen.'},{id:'acknowledge',label:'Acknowledge',description:'Own the harm.'},
  {id:'explain',label:'Explain',description:'Give your context.'},{id:'repair',label:'Repair',description:'Offer a next step.'}
];
export default function ConversationScene(){const s=useGameStore();
  if(s.mode==='title')return <main className="cs-root" data-app-mode="title"><section className="cs-outcome-card"><h1>UNSAID</h1><p>A conversation can change only when it is honest.</p><button onClick={s.start}>Start</button></section></main>;
  if(s.mode==='prologue')return <main className="cs-root" data-app-mode="prologue"><section className="cs-outcome-card"><h1>Before you speak</h1>{SCENARIO.prologue.map(p=><p key={p}>{p}</p>)}<button onClick={s.continueFromPrologue}>Continue</button><button onClick={s.returnToTitle}>Return to title</button></section></main>;
  if(s.mode==='outcome'&&s.outcome)return <main className="cs-root cs-outcome-mode" data-app-mode="outcome"><section className="cs-outcome-card"><h1>{s.outcome.title}</h1><p>{s.outcome.description}</p><button onClick={s.restart}>Replay</button><button onClick={s.returnToTitle}>Return to title</button></section></main>;
  const paused=s.mode==='paused', closing=s.mode==='closing', loading=s.status==='loading'; const canSend=!!s.input.trim()&&!!s.selectedIntention&&!paused&&!closing&&!loading&&s.turnIndex<SCENARIO.totalTurns;
  const last=[...s.transcript].reverse().find(x=>x.speaker==='character');
  return <main className="cs-root" data-app-mode={s.mode}><section className="cs-stage" aria-label="Conversation stage"><div className="cs-art-canvas" aria-hidden="true"><div className="cs-background"/><div className="cs-portrait-frame" data-portrait-state={PORTRAIT_DATA_STATE[s.portraitState]}><img className="cs-portrait-img" src={PORTRAIT_CLOSED[s.portraitState]} alt=""/></div><div className="cs-table-foreground"/></div>{last&&<div className="cs-dialogue-card" role="status"><p>{last.text}</p></div>}</section>
  <section className="cs-dock" aria-label="Conversation controls"><header><span>Turn {Math.min(s.turnIndex+1,SCENARIO.totalTurns)} of {SCENARIO.totalTurns}</span><span aria-label="Connection state">Connection</span><span aria-label="Pressure state">Pressure</span>{!paused&&!closing&&<button onClick={s.pause}>Pause</button>}</header>
  {paused?<div role="dialog"><p>The conversation is paused.</p><button onClick={s.resume}>Resume</button><button onClick={s.returnToTitle}>Return to title</button></div>:closing?<div role="region" aria-label="Final closing"><p>{s.closingMessage}</p><button onClick={s.continueToOutcome}>Continue</button></div>:<>
  <fieldset disabled={loading}><legend>What are you trying to do?</legend>{INTENTIONS.map(i=><button key={i.id} type="button" aria-pressed={s.selectedIntention===i.id} onClick={()=>s.selectIntention(i.id)}>{i.label}<small>{i.description}</small></button>)}</fieldset>
  {s.assessments.length>0&&<aside aria-label="Intent versus impact"><strong>Intent vs. Impact</strong><p>{s.assessments.at(-1)?.impactReason}</p></aside>}
  {s.status==='error'&&<div role="alert">{s.error}<button onClick={s.retryTurn}>Retry</button></div>}
  <textarea value={s.input} onChange={e=>s.setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(canSend)s.submitTurn();}}} disabled={loading} maxLength={SCENARIO.maxPlayerTextLength} aria-label="Your message" placeholder="Say something…" rows={3}/><button onClick={s.submitTurn} disabled={!canSend}>{loading?'Sending…':'Send message'}</button></>}</section></main>;
}
