// Canvas port of the DrawScope code in android/.../ui/BallComposable.kt.
// Constants keep their Kotlin names so the two files can be read side by side.
// Units: dp and sp map 1:1 to CSS px. The few raw-pixel values the Kotlin code
// uses inside DrawScope (the window lip, the triangle stroke) are converted at
// the density of the device the reference screenshots came from.

export const BALL_SIZE = 300;
export const WINDOW_RADIUS = 0.6; // fraction of the ball's radius
export const EIGHT_RADIUS = 0.36;
export const LIGHT_POSITION = { x: 0.34, y: 0.28 }; // fraction of the ball's size

// assets/screenshot-*.png: 1080 px wide for 411 dp → density 2.625.
const REFERENCE_DENSITY = 2.625;
const rawPx = (px: number) => px / REFERENCE_DENSITY;

const TRIANGLE_TOP = "#2E4390";
const TRIANGLE_BOTTOM = "#17245A";
const TRIANGLE_ERROR_TOP = "#7A3328";
const TRIANGLE_ERROR_BOTTOM = "#4A1C16";
const TRIANGLE_RATE_LIMIT_TOP = "#8A6A2E";
const TRIANGLE_RATE_LIMIT_BOTTOM = "#4A3714";
const ANSWER_TEXT_COLOR = "#E6ECF7";
const BLOCKED_RED = "#D8483A";

const FONT_FAMILY = "Roboto, system-ui, sans-serif";

export type TriangleStyle = "NORMAL" | "ERROR" | "RATE_LIMITED";

// Everything that changes what the ball's face looks like. Motion of the
// whole ball (bob, shake) is a CSS transform on its element, like graphicsLayer.
export interface BallFrame {
  flip: number; // degrees, 0 = "8" facing the viewer, 180 = window
  reveal: number; // floating-answer progress; may exceed 1 while the spring overshoots
  triangleText: string;
  triangleStyle: TriangleStyle;
  blockedAlpha: number;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Android blends gradients in premultiplied color, so fading to transparent
// never tints the color. Canvas blends raw RGB: white fading to transparent
// black turns grey on the way, which made the gloss look half its size. Giving
// each transparent stop the RGB of its neighbor reproduces Android's result
// exactly (in premultiplied terms every fully transparent color is the same).
const clear = (hex: string) => withAlpha(hex, 0);
const TRANSPARENT = clear("#000000"); // Compose Color.Transparent next to black stops

// Compose spreads gradient colors evenly between center and radius.
function radial(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colors: string[]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawBall(ctx: CanvasRenderingContext2D, size: number, frame: BallFrame) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  // .clip(CircleShape) on the Box: decals rolling off the edge disappear.
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  drawSphereBody(ctx, size);
  drawEightDecal(ctx, size, frame.flip);
  drawWindowDecal(ctx, size, frame.flip);
  drawSphereShading(ctx, size);
  if (frame.flip >= 180) drawFloatingAnswer(ctx, size, frame.triangleText, frame.triangleStyle, frame.reveal);
  drawGloss(ctx, size);
  if (frame.blockedAlpha > 0.01) drawBlockedMark(ctx, size, frame.blockedAlpha);

  ctx.restore();
}

function drawSphereBody(ctx: CanvasRenderingContext2D, size: number) {
  const r = size / 2;
  const lx = size * LIGHT_POSITION.x;
  const ly = size * LIGHT_POSITION.y;
  circle(ctx, r, r, r, radial(ctx, lx, ly, r * 1.55, ["#45484E", "#16171A", "#050505", "#000000"]));
}

// Drawn over the decals so the "8" disc and the window share the sphere's lighting.
function drawSphereShading(ctx: CanvasRenderingContext2D, size: number) {
  const r = size / 2;
  const lx = size * LIGHT_POSITION.x;
  const ly = size * LIGHT_POSITION.y;
  circle(ctx, r, r, r, radial(ctx, lx, ly, r * 1.6, [TRANSPARENT, withAlpha("#000000", 0.45)]));
  // Edge darkening makes the disc read as round rather than flat.
  circle(ctx, r, r, r, radial(ctx, r, r, r, [TRANSPARENT, TRANSPARENT, withAlpha("#000000", 0.7)]));
  // Blue bounce light from the background along the lower rim.
  circle(
    ctx,
    r,
    r,
    r,
    radial(ctx, r, r - r * 0.15, r * 1.02, [clear("#2A4A70"), withAlpha("#2A4A70", 0.35)]),
  );
}

// Features sit on the sphere's surface at a polar angle; turning the ball by
// `flip` degrees moves them along the vertical axis with cos() foreshortening.
function onSurface(ctx: CanvasRenderingContext2D, size: number, angleDeg: number, block: () => void) {
  const a = (angleDeg * Math.PI) / 180;
  const squash = Math.cos(a);
  if (squash <= 0.02) return;
  const r = size / 2;
  ctx.save();
  ctx.translate(r, r - r * Math.sin(a));
  ctx.scale(1, squash);
  block();
  ctx.restore();
}

function drawEightDecal(ctx: CanvasRenderingContext2D, size: number, flip: number) {
  onSurface(ctx, size, flip, () => {
    circle(ctx, 0, 0, (size / 2) * EIGHT_RADIUS, "#F2F2EE");
    ctx.fillStyle = "#111111";
    ctx.font = `900 64px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // Center the glyph itself: font line boxes differ between platforms, the
    // digit's own bounds don't.
    const m = ctx.measureText("8");
    ctx.fillText("8", 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  });
}

function drawWindowDecal(ctx: CanvasRenderingContext2D, size: number, flip: number) {
  onSurface(ctx, size, flip - 180, () => {
    const r = (size / 2) * WINDOW_RADIUS;
    const lip = rawPx(8);
    // Recessed lip: lit on top, falling into shadow at the bottom.
    const lipGradient = ctx.createLinearGradient(0, -r - lip, 0, r + lip);
    lipGradient.addColorStop(0, "#3A3D42");
    lipGradient.addColorStop(1, "#0A0A0A");
    circle(ctx, 0, 0, r + lip, lipGradient);
    circle(ctx, 0, 0, r, "#000000");
    circle(ctx, 0, 0, r, radial(ctx, 0, 0, r, ["#0B0E16", "#000000"]));
  });
}

function drawGloss(ctx: CanvasRenderingContext2D, size: number) {
  const r = size / 2;
  const lx = size * LIGHT_POSITION.x;
  const ly = size * LIGHT_POSITION.y;
  circle(ctx, lx, ly, r * 0.55, radial(ctx, lx, ly, r * 0.55, [withAlpha("#FFFFFF", 0.1), clear("#FFFFFF")]));
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate((-35 * Math.PI) / 180);
  ctx.scale(1.6, 0.8);
  circle(ctx, 0, 0, r * 0.13, radial(ctx, 0, 0, r * 0.13, [withAlpha("#FFFFFF", 0.42), clear("#FFFFFF")]));
  ctx.restore();
}

export function answerFontSize(text: string): number {
  if (text.length <= 4) return 26;
  if (text.length <= 12) return 20;
  if (text.length <= 18) return 16;
  return 14;
}

// Greedy word wrap honoring explicit "\n", like Compose Text inside a fixed-width Box.
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawFloatingAnswer(
  ctx: CanvasRenderingContext2D,
  size: number,
  text: string,
  style: TriangleStyle,
  progress: number,
) {
  if (progress <= 0.01) return;
  const windowDiameter = size * WINDOW_RADIUS;
  const rc = (windowDiameter / 2) * 0.9; // circumradius
  const c = size / 2;
  const p = progress;

  ctx.save();
  // Rising out of the dark liquid: small, dim, tilted, and lower, settling
  // with a spring overshoot that reads as a wobble (graphicsLayer, pivot center).
  ctx.globalAlpha = Math.min(1, Math.max(0, p));
  ctx.translate(c, c + (1 - p) * 22);
  ctx.rotate(((1 - p) * -28 * Math.PI) / 180);
  ctx.scale(0.55 + 0.45 * p, 0.55 + 0.45 * p);

  const half = (rc * Math.sqrt(3)) / 2;
  ctx.beginPath();
  ctx.moveTo(-half, -rc / 2);
  ctx.lineTo(half, -rc / 2);
  ctx.lineTo(0, rc);
  ctx.closePath();
  const [top, bottom] =
    style === "ERROR"
      ? [TRIANGLE_ERROR_TOP, TRIANGLE_ERROR_BOTTOM]
      : style === "RATE_LIMITED"
        ? [TRIANGLE_RATE_LIMIT_TOP, TRIANGLE_RATE_LIMIT_BOTTOM]
        : [TRIANGLE_TOP, TRIANGLE_BOTTOM];
  const gradient = ctx.createLinearGradient(0, -rc / 2, 0, rc);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = rawPx(10);
  ctx.lineJoin = "round";
  ctx.stroke();

  // Text area kept inside the triangle's wide upper part.
  const fontSize = answerFontSize(text);
  const lineHeight = fontSize * 1.1;
  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = ANSWER_TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapLines(text, rc * 1.12, (s) => ctx.measureText(s).width);
  const centerY = -rc * 0.12;
  lines.forEach((line, i) => ctx.fillText(line, 0, centerY + (i - (lines.length - 1) / 2) * lineHeight));
  ctx.restore();
}

// BLOCKED is a refusal, not an answer: a red ✕ over the "8" face.
function drawBlockedMark(ctx: CanvasRenderingContext2D, size: number, alpha: number) {
  const scale = 0.7 + 0.3 * alpha;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = BLOCKED_RED;
  ctx.font = `900 100px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText("✕");
  ctx.fillText("✕", 0, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  ctx.restore();
}

// The floor shadow under the ball: it doesn't move, it fades as the ball lifts.
export function drawShadow(ctx: CanvasRenderingContext2D, width: number, height: number, lift: number) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, 0.16);
  const r = width / 2;
  circle(ctx, 0, 0, r, radial(ctx, 0, 0, r, [withAlpha("#000000", 0.55 - 0.15 * lift), TRANSPARENT]));
  ctx.restore();
}
