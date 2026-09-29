// rememberSaveable in MainScreen.kt keeps the question and the ball's state
// across rotation and process death; the web equivalent is sessionStorage,
// which survives a reload but not closing the tab. Nothing is kept longer.
import { restoredBallState, type BallState, type ScreenState } from "./state.ts";

const KEY = "hunch8:screen";
const BALL_STATES: readonly BallState[] = ["IDLE", "THINKING", "ANSWERED", "ERROR", "RATE_LIMITED", "BLOCKED"];

export interface SavedScreen extends ScreenState {
  question: string;
}

export function loadScreen(storage: Pick<Storage, "getItem"> | undefined): SavedScreen {
  const empty: SavedScreen = { question: "", ballState: "IDLE", answerText: "" };
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw) as Partial<SavedScreen>;
    const ballState = BALL_STATES.includes(saved.ballState as BallState) ? (saved.ballState as BallState) : "IDLE";
    return {
      question: typeof saved.question === "string" ? saved.question : "",
      ballState: restoredBallState(ballState),
      answerText: typeof saved.answerText === "string" ? saved.answerText : "",
    };
  } catch {
    return empty; // storage blocked or corrupt: start fresh, never fail to load
  }
}

export function saveScreen(storage: Pick<Storage, "setItem"> | undefined, screen: SavedScreen) {
  try {
    storage?.setItem(KEY, JSON.stringify(screen));
  } catch {
    // Private mode or quota: losing the draft on reload is acceptable.
  }
}
