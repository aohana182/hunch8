// Screen logic ported from android/.../MainScreen.kt and the BallState enum in
// BallComposable.kt. Kept free of DOM so it can be unit-tested directly.
import type { Hunch8Result } from "./proxyClient.ts";

export type BallState = "IDLE" | "THINKING" | "ANSWERED" | "ERROR" | "RATE_LIMITED" | "BLOCKED";

export interface ScreenState {
  ballState: BallState;
  answerText: string;
}

export const MAX_QUESTION_LENGTH = 500;

// The ball is the only trigger, so this is also the debounce: a second tap
// while a request is in flight is ignored rather than queued.
export function canAsk(question: string, ballState: BallState): boolean {
  return question.trim() !== "" && question.length <= MAX_QUESTION_LENGTH && ballState !== "THINKING";
}

// Only a success replaces the answer text; the other states draw their own
// fixed text, so the previous answer is simply carried along (as on Android).
export function stateForResult(result: Hunch8Result, previousAnswer: string): ScreenState {
  switch (result.kind) {
    case "success":
      return { ballState: "ANSWERED", answerText: result.answer };
    case "rateLimited":
      return { ballState: "RATE_LIMITED", answerText: previousAnswer };
    case "blocked":
      return { ballState: "BLOCKED", answerText: previousAnswer };
    case "networkError":
      return { ballState: "ERROR", answerText: previousAnswer };
  }
}

// A restored THINKING state means the page was reloaded mid-request - the
// request that would have completed it is gone, so it would stay stuck forever.
export function restoredBallState(saved: BallState): BallState {
  return saved === "THINKING" ? "IDLE" : saved;
}

// Word for word from BallComposable.kt's contentDescription, so screen
// readers (and the E2E tests) hear the same thing on both platforms.
export function ballDescription(state: BallState, answerText: string): string {
  switch (state) {
    case "IDLE":
      return "Magic ball. Tap to ask.";
    case "THINKING":
      return "The ball is thinking";
    case "ANSWERED":
      return `The ball says: ${answerText}`;
    case "ERROR":
      return "The app isn't responding";
    case "RATE_LIMITED":
      return "Daily limit reached, come back tomorrow";
    case "BLOCKED":
      return "Hunch8 won't answer that";
  }
}
