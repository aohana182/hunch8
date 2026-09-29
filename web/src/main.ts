import { Ball } from "./ball/ball.ts";
import { setUpHelp } from "./help.ts";
import { ask, proxyUrlFrom } from "./proxyClient.ts";
import { setUpUpdates } from "./pwaUpdate.ts";
import { loadScreen, saveScreen } from "./session.ts";
import { setUpShake, shakeSupported } from "./shakeControl.ts";
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

async function askQuestion() {
  const question = questionInput.value;
  if (!canAsk(question, screen.ballState)) return;

  questionInput.blur(); // hides the phone keyboard, like clearFocus() on Android
  screen = { ...screen, ballState: "THINKING" };
  render();

  const result = await ask(PROXY_URL, question);
  screen = stateForResult(result, screen.answerText);
  render();
  if (screen.ballState === "ANSWERED" && !reducedMotion.matches) navigator.vibrate?.(40); // Android only
  applyUpdateIfSafe();
}

ballButton.addEventListener("click", askQuestion);

const help = document.querySelector<HTMLDialogElement>("#help")!;

// Shake is another trigger for the same action as tapping the ball. It stays
// quiet while a dialog is open or the app is in the background.
const shake = setUpShake(() => {
  if (!help.open && !document.hidden) void askQuestion();
});
const shakeRow = document.querySelector<HTMLElement>("#shake-row")!;
const shakeToggle = document.querySelector<HTMLInputElement>("#shake-toggle")!;
if (shakeSupported()) {
  shakeRow.hidden = false;
  shakeToggle.checked = shake.enabled();
  // Runs from the tap on the switch, which is what iOS demands for its permission prompt.
  shakeToggle.addEventListener("change", async () => {
    shakeToggle.checked = await shake.set(shakeToggle.checked);
  });
}

setUpHelp(document.querySelector<HTMLButtonElement>("#help-button")!, help);

renderField();
render();
ball.start();

// Production only: in dev the worker would cache Vite's live modules.
let applyUpdateIfSafe = () => {};
if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    applyUpdateIfSafe = setUpUpdates(() => ({
      busy: screen.ballState === "THINKING",
      typing: document.activeElement === questionInput,
    }));
  });
}
