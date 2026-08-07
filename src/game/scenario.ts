import type {
  DeltaBounds,
  FinalClosures,
  OutcomeDef,
  StateBounds,
} from './types.js';

export const SCENARIO = {
  id: 'say-it-again',
  title: 'UNSAID',
  description: 'A difficult café conversation after a broken promise.',
  openingLine: 'You said you wanted to talk.',
  totalTurns: 10,
  maxPlayerTextLength: 500,
  startingState: { engagement: -3, tension: 1 },
  bounds: {
    engagement: { min: -10, max: 10 },
    tension: { min: -10, max: 10 },
  } as StateBounds,
  deltaBounds: {
    engagementDelta: { min: -3, max: 3 },
    tensionDelta: { min: -3, max: 3 },
  } as DeltaBounds,
  prologueParts: [
    {
      title: 'NINE YEARS',
      paragraphs: [
        'You have known each other for nine years.',
        'She is the person who remembers how you take your coffee, answers messages after midnight, and can usually tell when "I\'m fine" means the opposite.',
        'Three weeks ago, she held her first public photography exhibition. It was only one room in a local arts space, but she had spent years making the work. She invited six people. You were one of them.',
      ],
    },
    {
      title: 'THE PROMISE',
      paragraphs: [
        'You had seen many of the photographs before anyone else.',
        'You helped her decide which ones to display. You listened while she worried that nobody would understand them. More than once, you promised that you would be there.',
        'On the day of the exhibition, you forgot. By the time you remembered, it had already begun. You imagined arriving late, seeing her face, and admitting that the promise had slipped your mind.',
        'So you stayed away.',
      ],
    },
    {
      title: 'THE LIE',
      paragraphs: [
        'When she messaged to ask where you were, you panicked.',
        'You wrote:',
      ],
      highlightQuote: 'Something came up.',
      postQuoteParagraphs: [
        'It was easier than admitting the truth. Afterward, every hour that passed made telling her more difficult.',
        'You have barely spoken for three weeks. The silence has been its own weight.',
        'Eventually, you asked her to meet at the café where the two of you used to talk about everything.',
        'She agreed.',
        'She is already waiting.',
      ],
    },
  ],
  prologue: [
    'You have known each other for nine years. She is the person who remembers how you take your coffee, answers messages after midnight, and can usually tell when "I\'m fine" means the opposite. Three weeks ago, she held her first public photography exhibition. It was only one room in a local arts space, but she had spent years making the work. She invited six people. You were one of them.',
    'You had seen many of the photographs before anyone else. You helped her decide which ones to display. You listened while she worried that nobody would understand them. More than once, you promised that you would be there. On the day of the exhibition, you forgot. By the time you remembered, it had already begun. You imagined arriving late, seeing her face, and admitting that the promise had slipped your mind. So you stayed away.',
    'When she messaged to ask where you were, you panicked. You wrote: "Something came up." It was easier than admitting the truth. Afterward, every hour that passed made telling her more difficult. You have barely spoken for three weeks. The silence has been its own weight. Eventually, you asked her to meet at the café where the two of you used to talk about everything. She agreed. She is already waiting.',
  ],
  facts: [
    'nine-year friendship',
    'first public photography exhibition',
    'six invited guests',
    'the player helped choose the displayed photographs',
    'the player repeatedly promised to attend',
    'the player forgot and remembered after the exhibition began',
    'the player stayed away out of shame rather than arriving late',
    'the player lied that "Something came up."',
    'three weeks of silence',
    'café meeting',
  ],
  hiddenFacts: [
    'the friend noticed the player\'s empty chair',
    'the friend repeatedly checked the door',
    'another guest asked where the player was',
    'the friend defended the player to the guest',
    'the friend packed up the exhibition afterward',
    'the friend missed the player during the silence',
    'part of the friend wants the friendship to survive',
  ],
  fallbackCharacterLine:
    "I'm trying to understand what you want from this conversation.",
  fallbackClosures: {
    even:
      "I don't know if we're okay yet. But this is the first time in weeks that this has felt honest.",
    smoothed: "I think it's best if we finish our drinks and leave it here for today.",
    the_speech: "You're not a terrible person. I know you panicked. I just wish this conversation had left more room for what it did to me.",
  } as FinalClosures,
  outcomes: {
    even: {
      id: 'even',
      title: 'Even',
      description: 'Not forgiveness. Not yet. But the truth is finally between you.',
    },
    smoothed: {
      id: 'smoothed',
      title: 'Smoothed',
      description: 'The conversation ends without repair: courteous, cold, or simply unfinished.',
    },
    the_speech: {
      id: 'the_speech',
      title: 'The Speech',
      description: 'You came to apologize. Somehow, they ended up comforting you.',
    },
  } as Record<string, OutcomeDef>,
};
