import { create } from 'zustand';
import type { AppMode, FinalClosures, OutcomeDef, PlayerIntent, PortraitState, TranscriptEntry, TurnAssessment, TurnRequest } from './types';
import { SCENARIO } from './scenario';
import { applyTurn, derivePortraitState } from './state';
import { classifyAlignment, evaluateOutcome } from './outcome';
import { postTurn } from '../lib/turnClient';

type Status = 'idle' | 'loading' | 'error';
export interface GameStore {
  mode: AppMode; status: Status; error: string | null; input: string; selectedIntention: PlayerIntent | null;
  engagement: number; tension: number; portraitState: PortraitState; transcript: TranscriptEntry[]; turnIndex: number;
  assessments: TurnAssessment[]; outcome: OutcomeDef | null; closingMessage: string | null;
  pendingMessage: string | null; pendingIntention: PlayerIntent | null;
  start: () => void; continueFromPrologue: () => void; selectIntention: (intent: PlayerIntent) => void;
  setInput: (input: string) => void; submitTurn: () => Promise<void>; retryTurn: () => Promise<void>;
  pause: () => void; resume: () => void; continueToOutcome: () => void; restart: () => void; returnToTitle: () => void;
}
function initial(): Omit<GameStore, 'start'|'continueFromPrologue'|'selectIntention'|'setInput'|'submitTurn'|'retryTurn'|'pause'|'resume'|'continueToOutcome'|'restart'|'returnToTitle'> {
  const s = SCENARIO.startingState;
  return { mode:'title', status:'idle', error:null, input:'', selectedIntention:null, engagement:s.engagement, tension:s.tension, portraitState:derivePortraitState(s.engagement,s.tension), transcript:[], turnIndex:0, assessments:[], outcome:null, closingMessage:null, pendingMessage:null, pendingIntention:null };
}
async function execute(get:()=>GameStore,set:(p:Partial<GameStore>)=>void,message:string,intention:PlayerIntent) {
  const state=get(); const request:TurnRequest={scenarioId:SCENARIO.id,turnIndex:state.turnIndex,playerText:message,selectedIntention:intention,state:{engagement:state.engagement,tension:state.tension},recentTranscript:state.transcript};
  try {
    const response=await postTurn(request); const current=get();
    const next=applyTurn({engagement:current.engagement,tension:current.tension,portraitState:current.portraitState},response.assessment.engagementDelta,response.assessment.tensionDelta);
    const assessment:TurnAssessment={...response.assessment,selectedIntent:intention,alignment:classifyAlignment(intention,response.assessment.perceivedImpact)};
    const assessments=[...current.assessments,assessment]; const turnIndex=current.turnIndex+1;
    const transcript=[...current.transcript,{speaker:'player' as const,text:message},{speaker:'character' as const,text:response.characterText}];
    if (turnIndex === SCENARIO.totalTurns) {
      const id=evaluateOutcome({assessments,finalEngagement:next.engagement,finalTension:next.tension});
      const closures:FinalClosures=response.finalClosures ?? SCENARIO.fallbackClosures;
      set({engagement:next.engagement,tension:next.tension,portraitState:next.portraitState,transcript,assessments,turnIndex,input:'',selectedIntention:null,pendingMessage:null,pendingIntention:null,status:'idle',error:null,outcome:SCENARIO.outcomes[id],closingMessage:closures[id],mode:'closing'});
    } else set({engagement:next.engagement,tension:next.tension,portraitState:next.portraitState,transcript,assessments,turnIndex,input:'',selectedIntention:null,pendingMessage:null,pendingIntention:null,status:'idle',error:null});
  } catch (e) { set({status:'error',error:e instanceof Error?e.message:'Something went wrong. Please try again.'}); }
}
export const useGameStore=create<GameStore>((set,get)=>({
  ...initial(),
  start:()=>set({...initial(),mode:'prologue'}), continueFromPrologue:()=>set({mode:'playing',transcript:[{speaker:'character',text:SCENARIO.openingLine}]}),
  selectIntention:selectedIntention=>set({selectedIntention}), setInput:input=>set({input}),
  submitTurn:async()=>{const s=get(),message=s.input.trim(),intent=s.selectedIntention;if(!message||!intent||s.status==='loading'||s.mode!=='playing'||s.turnIndex>=SCENARIO.totalTurns)return;if(message.length>SCENARIO.maxPlayerTextLength){set({status:'error',error:`Message must be ${SCENARIO.maxPlayerTextLength} characters or less.`});return;}set({status:'loading',error:null,pendingMessage:message,pendingIntention:intent});await execute(get,set,message,intent);},
  retryTurn:async()=>{const s=get();if(s.status!=='error'||!s.pendingMessage||!s.pendingIntention||s.mode!=='playing')return;set({status:'loading',error:null});await execute(get,set,s.pendingMessage,s.pendingIntention);},
  pause:()=>{if(get().mode==='playing')set({mode:'paused'});}, resume:()=>{if(get().mode==='paused')set({mode:'playing'});},
  continueToOutcome:()=>{if(get().mode==='closing')set({mode:'outcome'});}, restart:()=>set({...initial(),mode:'prologue'}), returnToTitle:()=>set(initial())
}));
export { initial as createInitialState };
