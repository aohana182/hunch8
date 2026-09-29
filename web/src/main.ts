import { Ball } from "./ball/ball.ts";
import { ask, proxyUrlFrom } from "./proxyClient.ts";
import { ballDescription, canAsk, stateForResult, type ScreenState } from "./state.ts";

const PROXY_URL = proxyUrlFrom(import.meta.env.VITE_PROXY_URL);

const questionInput = document.querySelector<HTMLTextAreaElement>("#question")!;
const ballButton = document.querySelector<HTMLButtonElement>("#ball")!;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const ball = new Ball(
  ballButton,
  document.querySelector<HTMLCanvasElement>("#ball-canvas")!,
  document.querySelector<HTMLCanvasElement>("#ball-shadow")!,
  () => reducedMotion.matches,
);

let screen: ScreenState = { ballState: "IDLE", answerText: "" };

function render() {
  ballButton.setAttribute("aria-label", ballDescription(screen.ballState, screen.answerText));
  ballButton.setAttribute("aria-disabled", String(screen.ballState === "THINKING"));
  ball.setState(screen.ballState, screen.answerText);
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
ball.start();
