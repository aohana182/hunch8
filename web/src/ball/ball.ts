// Port of the BallComposable composable's state and motion: the three
// LaunchedEffects (flip, reveal, blocked ✕) and the infinite bob and shake.
// Drawing lives in draw.ts; this decides what to draw each frame.
import type { BallState } from "../state.ts";
import { Animated, fastOutSlowIn, linear, repeatReverse, type AnimationSpec } from "./animation.ts";
import { NO_INERTIA, type BallInertia, type Inertia } from "./inertia.ts";
import { BALL_SIZE, drawBall, drawShadow, type BallFrame, type TriangleStyle } from "./draw.ts";

const FLIP: AnimationSpec = { type: "tween", durationMs: 750, easing: fastOutSlowIn };
const HIDE_ANSWER: AnimationSpec = { type: "tween", durationMs: 220, easing: fastOutSlowIn }; // tween(220)
const REVEAL: AnimationSpec = { type: "spring", dampingRatio: 0.45, stiffness: 50 }; // StiffnessVeryLow
const BLOCKED_FADE: AnimationSpec = { type: "tween", durationMs: 200, easing: fastOutSlowIn };
const BOB_MS = 2200;
const SHAKE_MS = 70;

export class Ball {
  private state: BallState = "IDLE";
  private answerText = "";
  private readonly flip = new Animated(0);
  private readonly reveal = new Animated(0);
  private readonly blockedAlpha = new Animated(0);
  private readonly startMs = performance.now();
  private effectGeneration = 0; // bumps when (state, answerText) changes, like a relaunched LaunchedEffect
  private flipWaiters: (() => void)[] = [];
  private lastFrame = "";
  private lastTransform = "";
  private lastLift = NaN;
  private dpr = 0;
  private readonly button: HTMLElement;
  private readonly ballCanvas: HTMLCanvasElement;
  private readonly shadowCanvas: HTMLCanvasElement;
  private readonly reducedMotion: () => boolean;
  private inertiaSource: BallInertia | undefined;
  private inertia: Inertia = NO_INERTIA;

  constructor(
    button: HTMLElement,
    ballCanvas: HTMLCanvasElement,
    shadowCanvas: HTMLCanvasElement,
    reducedMotion: () => boolean,
  ) {
    this.button = button;
    this.ballCanvas = ballCanvas;
    this.shadowCanvas = shadowCanvas;
    this.reducedMotion = reducedMotion;
  }

  // The phone-motion layer; the caller feeds it sensor samples.
  setInertia(source: BallInertia | undefined) {
    this.inertiaSource = source;
  }

  start() {
    const loop = (now: number) => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setState(state: BallState, answerText: string) {
    const stateChanged = state !== this.state;
    if (!stateChanged && answerText === this.answerText) return;
    this.state = state;
    this.answerText = answerText;
    const now = performance.now();

    if (stateChanged) {
      // BLOCKED is a refusal, not an answer - the ball never flips to show a
      // window for it. Once flipped, the ball stays on its window face.
      if (state !== "IDLE" && state !== "BLOCKED" && this.flip.target < 180) {
        void this.flip.animateTo(180, FLIP, now);
      }
      void this.blockedAlpha.animateTo(state === "BLOCKED" ? 1 : 0, BLOCKED_FADE, now);
    }
    void this.runRevealEffect(state, ++this.effectGeneration);
  }

  private async runRevealEffect(state: BallState, generation: number) {
    if (state === "THINKING") {
      await this.reveal.animateTo(0, HIDE_ANSWER, performance.now());
    } else if (state === "ANSWERED" || state === "ERROR" || state === "RATE_LIMITED") {
      await this.flipDone();
      if (generation !== this.effectGeneration) return; // superseded while waiting
      this.reveal.snapTo(0);
      await this.reveal.animateTo(1, REVEAL, performance.now());
    }
  }

  private flipDone(): Promise<void> {
    if (this.flip.value >= 180) return Promise.resolve();
    return new Promise((resolve) => this.flipWaiters.push(resolve));
  }

  private frame(now: number) {
    this.flip.tick(now);
    this.reveal.tick(now);
    this.blockedAlpha.tick(now);
    if (this.flip.value >= 180 && this.flipWaiters.length) {
      const waiters = this.flipWaiters;
      this.flipWaiters = [];
      waiters.forEach((resolve) => resolve());
    }

    const elapsed = now - this.startMs;
    const still = this.reducedMotion();
    this.inertia = still || !this.inertiaSource ? NO_INERTIA : this.inertiaSource.step(now);
    const bob = still ? 0 : -4 + 8 * repeatReverse(elapsed, BOB_MS, fastOutSlowIn);
    const shake = still ? 0 : -1 + 2 * repeatReverse(elapsed, SHAKE_MS, linear);
    const thinking = this.state === "THINKING";

    // graphicsLayer on the ball Box: bob when resting, shake and wobble while thinking.
    const x = thinking ? shake * 7 : 0;
    const y = thinking ? 0 : bob;
    const rotation = thinking ? shake * 4 : 0;
    const transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    if (transform !== this.lastTransform) {
      this.lastTransform = transform;
      this.button.style.transform = transform;
    }

    // Everything below only redraws when its output would change, so a ball
    // at rest (reduced motion, or a background tab) costs next to nothing.
    this.resizeForDensity();
    const lift = (bob + 4) / 8;
    if (lift !== this.lastLift) {
      this.lastLift = lift;
      const shadowCtx = this.shadowCanvas.getContext("2d")!;
      drawShadow(shadowCtx, this.shadowCanvas.width / this.dpr, this.shadowCanvas.height / this.dpr, lift);
    }

    const frame = this.ballFrame();
    const key = JSON.stringify(frame);
    if (key !== this.lastFrame) {
      this.lastFrame = key;
      drawBall(this.ballCanvas.getContext("2d")!, BALL_SIZE, frame);
    }
  }

  private ballFrame(): BallFrame {
    let triangleText = this.answerText;
    let triangleStyle: TriangleStyle = "NORMAL";
    if (this.state === "ERROR") {
      triangleText = "App not\nresponding";
      triangleStyle = "ERROR";
    } else if (this.state === "RATE_LIMITED") {
      triangleText = "Daily limit\nreached";
      triangleStyle = "RATE_LIMITED";
    }
    return {
      flip: this.flip.value,
      reveal: this.reveal.value,
      triangleText,
      triangleStyle,
      blockedAlpha: this.blockedAlpha.value,
      inertia: this.inertia,
    };
  }

  // Backing stores sized to the screen's pixel density so the ball stays crisp.
  private resizeForDensity() {
    const dpr = window.devicePixelRatio || 1;
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    for (const canvas of [this.ballCanvas, this.shadowCanvas]) {
      // clientWidth, not getBoundingClientRect: the latter includes the shake's
      // rotation and would size the canvas to the rotated bounding box.
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.lastFrame = ""; // force a redraw at the new density
    this.lastLift = NaN;
  }
}
