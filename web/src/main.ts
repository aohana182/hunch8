import { Ball } from "./ball/ball.ts";
import { BallInertia } from "./ball/inertia.ts";
import { setUpHelp } from "./help.ts";
import { ask, proxyUrlFrom } from "./proxyClient.ts";
import { setUpUpdates } from "./pwaUpdate.ts";
import { loadScreen, saveScreen } from "./session.ts";
import { createShakeDetector } from "./shake.ts";
import { motionSupported, setUpMotion } from "./motionControl.ts";
import { ballDescription, canAsk, stateForResult, MAX_QUESTION_LENGTH, type ScreenState } from "./state.ts";

const PROXY_URL = proxyUrlFrom(import.meta.env.VITE_PROXY_URL);

const questionInput = document.querySelector<HTMLTextAreaElement>("#question")!;
const field = questionInput.closest<HTMLElement>(".field")!;
const charCounter = document.querySelector<HTMLSpanElement>("#char-counter");
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
  const len = questionInput.value.length;
  const filled = len > 0;
  field.classList.toggle("is-filled", filled);
  clearButton.hidden = !filled;
  questionInput.style.height = "auto";
  questionInput.style.height = `${questionInput.scrollHeight}px`;
  if (charCounter) {
    charCounter.textContent = `${len} / ${MAX_QUESTION_LENGTH}`;
    charCounter.classList.toggle("is-warning", len >= 450 && len < MAX_QUESTION_LENGTH);
    charCounter.classList.toggle("is-full", len >= MAX_QUESTION_LENGTH);
  }
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

// One opt-in for both uses of the motion sensor. Shake is another trigger for
// the same action as tapping the ball (quiet while a dialog is open or the app
// is in the background); the same samples also move the ball's face.
const detectShake = createShakeDetector();
const inertia = new BallInertia();
ball.setInertia(inertia);
const motion = setUpMotion((sample, timeMs) => {
  inertia.feed(sample, timeMs);
  if (detectShake(sample, timeMs) && !help.open && !document.hidden) void askQuestion();
});
const motionRow = document.querySelector<HTMLElement>("#motion-row")!;
const motionToggle = document.querySelector<HTMLInputElement>("#motion-toggle")!;
if (motionSupported()) {
  motionRow.hidden = false;
  motionToggle.checked = motion.enabled();
  // Runs from the tap on the switch, which is what iOS demands for its permission prompt.
  motionToggle.addEventListener("change", async () => {
    motionToggle.checked = await motion.set(motionToggle.checked);
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
