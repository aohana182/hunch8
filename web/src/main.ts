import { Ball } from "./ball/ball.ts";
import { setUpHelp } from "./help.ts";
import { ask, proxyUrlFrom } from "./proxyClient.ts";
import { loadScreen, saveScreen } from "./session.ts";
import { ballDescription, canAsk, stateForResult, type ScreenState } from "./state.ts";

const PROXY_URL = proxyUrlFrom(import.meta.env.VITE_PROXY_URL);

const questionInput = document.querySelector<HTMLTextAreaElement>("#question")!;
const field = questionInput.closest<HTMLElement>(".field")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-question")!;
const ballButton = document.querySelector<HTMLButtonElement>("#ball")!;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// The sessionStorage getter itself can throw (blocked storage), not just its methods.
const storage = (() => {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
})();

const ball = new Ball(
  ballButton,
  document.querySelector<HTMLCanvasElement>("#ball-canvas")!,
  document.querySelector<HTMLCanvasElement>("#ball-shadow")!,
  () => reducedMotion.matches,
);

const saved = loadScreen(storage);
let screen: ScreenState = { ballState: saved.ballState, answerText: saved.answerText };
questionInput.value = saved.question;

function render() {
  ballButton.setAttribute("aria-label", ballDescription(screen.ballState, screen.answerText));
  ballButton.setAttribute("aria-disabled", String(screen.ballState === "THINKING"));
  ball.setState(screen.ballState, screen.answerText);
  saveScreen(storage, { ...screen, question: questionInput.value });
}

// minLines = 3, maxLines = 6: grow with the text, then scroll.
function renderField() {
  const filled = questionInput.value !== "";
  field.classList.toggle("is-filled", filled);
  clearButton.hidden = !filled;
  questionInput.style.height = "auto";
  questionInput.style.height = `${questionInput.scrollHeight}px`;
}

questionInput.addEventListener("input", () => {
  renderField();
  saveScreen(storage, { ...screen, question: questionInput.value });
});

clearButton.addEventListener("click", () => {
  questionInput.value = "";
  renderField();
  saveScreen(storage, { ...screen, question: "" });
  questionInput.focus();
});

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

setUpHelp(
  document.querySelector<HTMLButtonElement>("#help-button")!,
  document.querySelector<HTMLDialogElement>("#help")!,
);

renderField();
render();
ball.start();

// Production only: in dev the worker would cache Vite's live modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No offline support (e.g. a private window) - the app works the same online.
    });
  });
}
