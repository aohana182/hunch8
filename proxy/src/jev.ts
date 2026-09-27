const ANSWERS: Record<string, { phrase: string; hint: string }> = {
  it_is_certain: { phrase: "It is certain", hint: "The background makes this an obvious, undeniable yes with no real doubt" },
  it_is_decidedly_so: { phrase: "It is decidedly so", hint: "Background strongly and decisively favors yes" },
  without_a_doubt: { phrase: "Without a doubt", hint: "Yes with total certainty, no hesitation at all" },
  yes_definitely: { phrase: "Yes, definitely", hint: "Confident, clear affirmative" },
  you_may_rely_on_it: { phrase: "You may rely on it", hint: "Yes, and it's a dependable, safe bet" },
  as_i_see_it_yes: { phrase: "As I see it, yes", hint: "Leaning yes based on interpretation of the background, slightly more subjective" },
  most_likely: { phrase: "Most likely", hint: "Probably yes, but not fully certain" },
  outlook_good: { phrase: "Outlook good", hint: "Things look favorable overall, moderate positive" },
  yes: { phrase: "Yes", hint: "Plain, simple affirmative with no elaboration needed" },
  signs_point_to_yes: { phrase: "Signs point to yes", hint: "Indirect evidence in the background suggests yes, mild positive" },
  reply_hazy: { phrase: "Reply hazy, try again", hint: "Background is too vague, thin, or contradictory to give a real answer" },
  ask_again_later: { phrase: "Ask again later", hint: "Not enough information right now, or the timing is wrong to call it" },
  better_not_tell_you_now: { phrase: "Better not tell you now", hint: "An answer exists but revealing it now would be premature or unwise" },
  cannot_predict_now: { phrase: "Cannot predict now", hint: "Genuinely unpredictable given the current information" },
  concentrate_and_ask_again: { phrase: "Concentrate and ask again", hint: "The question itself is unclear or underthought and needs refining" },
  dont_count_on_it: { phrase: "Don't count on it", hint: "Leaning no, unreliable, don't bank on it" },
  my_reply_is_no: { phrase: "My reply is no", hint: "Plain, simple negative" },
  my_sources_say_no: { phrase: "My sources say no", hint: "The context/background itself points to no" },
  outlook_not_so_good: { phrase: "Outlook not so good", hint: "Unfavorable overall trend" },
  very_doubtful: { phrase: "Very doubtful", hint: "Strong skepticism, unlikely to happen" },
};

const JEV_MODEL = "typesafe/jev-1.13";
const JEV_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";

export interface JevChoiceResult {
  answer: string;
  confidence: number;
  cost: number;
}

export async function askJev(apiKey: string, question: string, background: string): Promise<JevChoiceResult> {
  const criteria: Record<string, string> = {};
  for (const [key, { hint }] of Object.entries(ANSWERS)) {
    criteria[key] = hint;
  }

  const requestBody = {
    model: JEV_MODEL,
    state: `Question: ${question}\nBackground: ${background || "(none given)"}`,
    questions: {
      answer: {
        type: "choice",
        instructions:
          "Pick the 8-ball answer that best fits the asker's question and background. Commit to one — don't hedge.",
        criteria,
      },
    },
  };

  const response = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jev request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json<{
    answers: { answer: { choice: string; confidence: number } };
    usage?: { cost?: number };
  }>();

  const choiceKey = data.answers.answer.choice;
  const mapped = ANSWERS[choiceKey];
  if (!mapped) {
    throw new Error(`Jev returned an unrecognized choice key: ${choiceKey}`);
  }

  return {
    answer: mapped.phrase,
    confidence: data.answers.answer.confidence,
    cost: data.usage?.cost ?? 0,
  };
}
