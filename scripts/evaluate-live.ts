import 'dotenv/config';
import { GeminiModelAdapter } from '../server/adapters/GeminiModelAdapter';
import { ModelOutputSchema } from '../server/turn/schema';
import { SCENARIO } from '../src/game/scenario';

const messages=[
  ['understand','What hurt most when I did not come?'],['explain','I was overwhelmed, but I should have told you the truth.'],
  ['repair','What would rebuilding trust require from me?']
] as const;
async function main(){if(process.env.UNSAID_AI_MODE!=='live'||!process.env.GEMINI_API_KEY?.trim()){console.error('Live evaluation requires configured live mode and a Gemini key.');process.exit(1);}const adapter=new GeminiModelAdapter();let transcript:any[]=[];for(let i=0;i<messages.length;i++){const [selectedIntention,playerText]=messages[i];const output=ModelOutputSchema.safeParse(await adapter.generateTurn({scenarioId:SCENARIO.id,turnIndex:i,playerText,selectedIntention,state:{engagement:-3,tension:1},recentTranscript:transcript}));if(!output.success)throw new Error('Schema-invalid live response');if(/\b(ai|prompt|score|outcome)\b/i.test(output.data.characterText))throw new Error('Out-of-character live response');transcript.push({speaker:'player',text:playerText},{speaker:'character',text:output.data.characterText});console.log(`case ${i+1}: valid dynamic response`);}console.log('Focused live evaluation passed (3 requests).');}
main().catch(error=>{console.error(error instanceof Error?error.message:'Live evaluator failed');process.exit(1);});
