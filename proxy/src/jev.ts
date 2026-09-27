// Jev's Score primitive rates the answer on an ordered no→yes scale; the 20
// classic phrases are grouped into strength bands along that scale and one is
// picked at random within the band, so repeat questions vary like a real 8-ball.
const BANDS: { maxScore: number; phrases: string[] }[] = [
  { maxScore: 0.8, phrases: ["My reply is no", "My sources say no", "Very doubtful"] },
  { maxScore: 1.5, phrases: ["Don't count on it", "Outlook not so good"] },
  {
    maxScore: 2.5,
    phrases: [
      "Reply hazy, try again",
      "Ask again later",
      "Better not tell you now",
      "Cannot predict now",
      "Concentrate and ask again",
    ],
  },
  { maxScore: 3.2, phrases: ["As I see it, yes", "Most likely", "Outlook good", "Yes", "Signs point to yes"] },
  {
    maxScore: Infinity,
    phrases: ["It is certain", "It is decidedly so", "Without a doubt", "Yes, definitely", "You may rely on it"],
  },
];

const LEVELS = ["Definitely no", "Probably no", "Impossible to tell", "Probably yes", "Definitely yes"];

const INSTRUCTIONS =
  "Rate how strongly the answer to the asker's question is yes. " +
  "If the question offers two options ('X or Y?'), yes means the first option X and no means the second option Y. " +
  "Decide from any context the asker gives and plain common sense about what is actually best for the asker. " +
  "Use the middle only when there is genuinely nothing to go on.";

const JEV_MODEL = "typesafe/jev-1.13";
const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";

export interface JevResult {
  answer: string;
  confidence: number;
  cost: number;
}

export function phraseForScore(score: number, random: () => number = Math.random): string {
  const band = BANDS.find((b) => score < b.maxScore)!;
  return band.phrases[Math.floor(random() * band.phrases.length)];
}

export async function askJev(apiKey: string, question: string, background: string): Promise<JevResult> {
  const response = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state: background
        ? `Question: ${question}\nContext: ${background}`
        : `The asker's question, with any context they gave: ${question}`,
      questions: {
        verdict: { type: "score", instructions: INSTRUCTIONS, criteria: LEVELS },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Jev request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json<{
    answers: { verdict: { score: number; confidence: number } };
    usage?: { cost?: number };
  }>();

  const { score, confidence } = data.answers.verdict;
  if (typeof score !== "number") {
    throw new Error("Jev returned no score");
  }

  return {
    answer: phraseForScore(score),
    confidence,
    cost: data.usage?.cost ?? 0,
  };
}
