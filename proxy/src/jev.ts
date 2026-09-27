// Jev's Score primitive rates the answer on an ordered no→yes scale; the 20
// classic phrases are grouped into strength bands along that scale and one is
// picked at random within the band, so repeat questions vary like a real 8-ball.
const NON_COMMITTAL_PHRASES = [
  "Reply hazy, try again",
  "Ask again later",
  "Better not tell you now",
  "Cannot predict now",
  "Concentrate and ask again",
];

const BANDS: { maxScore: number; phrases: string[] }[] = [
  { maxScore: 0.8, phrases: ["My reply is no", "My sources say no", "Very doubtful"] },
  { maxScore: 1.5, phrases: ["Don't count on it", "Outlook not so good"] },
  { maxScore: 2.5, phrases: NON_COMMITTAL_PHRASES },
  { maxScore: 3.2, phrases: ["As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes"] },
  {
    maxScore: Infinity,
    phrases: ["It is certain", "It is decidedly so", "Without a doubt", "Yes, definitely", "You may rely on it"],
  },
];

// A confident-sounding phrase ("Without a doubt") should never come from a
// coin-flip-confidence score - eval trace #9 (evals/traces.md) caught exactly
// this: score landed in the top band, but Jev's own confidence was 0.5.
const LOW_CONFIDENCE_THRESHOLD = 0.6;

const LEVELS = ["Definitely no", "Probably no", "Impossible to tell", "Probably yes", "Definitely yes"];

const INSTRUCTIONS =
  "Rate how strongly the answer to the asker's question is yes. " +
  "If the question offers two options ('X or Y?'), yes means the first option X and no means the second option Y. " +
  "Decide from any context the asker gives and plain common sense about what is actually best for the asker. " +
  "Use the middle only when there is genuinely nothing to go on.";

const MODERATION_INSTRUCTIONS =
  "Does this question or context contain hate speech, slurs, harassment, sexual content involving minors, " +
  "or other content a novelty app should refuse to answer? Ignore mild profanity or crude humor - only flag " +
  "genuinely hateful, harassing, or predatory content.";

const MODERATION_THRESHOLD = 0.5;

const JEV_MODEL = "typesafe/jev-1.13";
const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";

export interface JevResult {
  answer: string;
  confidence: number;
  cost: number;
}

export class JevBlockedError extends Error {
  constructor() {
    super("Question flagged by content moderation");
    this.name = "JevBlockedError";
  }
}

export function phraseForScore(score: number, confidence: number, random: () => number = Math.random): string {
  const phrases =
    confidence < LOW_CONFIDENCE_THRESHOLD
      ? NON_COMMITTAL_PHRASES
      : BANDS.find((b) => score < b.maxScore)!.phrases;
  return phrases[Math.floor(random() * phrases.length)];
}

export async function askJev(apiKey: string, question: string, background: string): Promise<JevResult> {
  // Jev's `state` accepts a string, object, or array (verified against the
  // live API) - no need to hand-roll a "Question: X\nContext: Y" string.
  // In practice `background` is always empty: the app merges everything into
  // one field client-side. The separate parameter stays for any other caller
  // of this proxy that does send question/context separately.
  const state = background ? { question, context: background } : question;

  const response = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state,
      questions: {
        verdict: { type: "score", instructions: INSTRUCTIONS, criteria: LEVELS },
        flagged: {
          type: "noul",
          instructions: MODERATION_INSTRUCTIONS,
          criteria: { true: "Contains hateful, harassing, or otherwise inappropriate content", false: "A normal, benign question" },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Jev request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json<{
    answers: { verdict: { score: number; confidence: number }; flagged: { noul: number } };
    usage?: { cost?: number };
  }>();

  if (data.answers.flagged.noul >= MODERATION_THRESHOLD) {
    throw new JevBlockedError();
  }

  const { score, confidence } = data.answers.verdict;
  if (typeof score !== "number") {
    throw new Error("Jev returned no score");
  }

  return {
    answer: phraseForScore(score, confidence),
    confidence,
    cost: data.usage?.cost ?? 0,
  };
}
