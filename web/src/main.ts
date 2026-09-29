import { ask, PLACEHOLDER_PROXY_URL } from "./proxyClient.ts";
import { ballDescription, canAsk, stateForResult, type ScreenState } from "./state.ts";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || PLACEHOLDER_PROXY_URL;

const questionInput = document.querySelector<HTMLTextAreaElement>("#question")!;
const ballButton = document.querySelector<HTMLButtonElement>("#ball")!;
const ballText = document.querySelector<HTMLElement>("#ball-text")!;

let screen: ScreenState = { ballState: "IDLE", answerText: "" };

// Placeholder rendering until the canvas ball lands: the text the triangle
// will show, taken from BallComposable.kt.
function placeholderText({ ballState, answerText }: ScreenState): string {
  switch (ballState) {
    case "IDLE":
      return "8";
    case "THINKING":
      return "…";
    case "ANSWERED":
      return answerText;
    case "ERROR":
      return "App not\nresponding";
    case "RATE_LIMITED":
      return "Daily limit\nreached";
    case "BLOCKED":
      return "✕";
  }
}

function render() {
  ballButton.setAttribute("aria-label", ballDescription(screen.ballState, screen.answerText));
  ballButton.setAttribute("aria-disabled", String(screen.ballState === "THINKING"));
  ballText.textContent = placeholderText(screen);
}

ballButton.addEventListener("click", async () => {
  const question = questionInput.value;
  if (!canAsk(question, screen.ballState)) return;

  questionInput.blur(); // hides the phone keyboard, like clearFocus() on Android
  screen = { ...screen, ballState: "THINKING" };
  render();

  const result = await ask(PROXY_URL, question);
  screen = stateForResult(result, screen.answerText);
  render();
});

render();
