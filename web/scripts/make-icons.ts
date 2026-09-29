// Regenerates web/public/icons from the ball in assets/screenshot-idle.png -
// the same image the README shows. Run with `npm run icons` (needs a
// Playwright browser; PW_CHROMIUM_CHANNEL=msedge works too).
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const source = readFileSync(`${root}assets/screenshot-idle.png`).toString("base64");
const outDir = `${root}web/public/icons/`;

// Measured in the 1080x2400 screenshot: a 300dp ball at density 2.625.
const BALL = { cx: 540, cy: 1452, r: 393 };
const SURFACE = "#122333"; // Hunch8Surface, the app's visible background

// ballFraction: the ball's diameter as a share of the icon's width.
const ICONS = [
  { file: "icon-192.png", size: 192, ballFraction: 0.9, background: SURFACE },
  { file: "icon-512.png", size: 512, ballFraction: 0.9, background: SURFACE },
  // Maskable: launchers may crop to a circle of 80% - keep the ball inside it.
  { file: "icon-maskable-512.png", size: 512, ballFraction: 0.76, background: SURFACE },
  { file: "apple-touch-icon.png", size: 180, ballFraction: 0.84, background: SURFACE },
  { file: "favicon-32.png", size: 32, ballFraction: 1, background: null },
];

const channel = process.env.PW_CHROMIUM_CHANNEL;
const browser = await chromium.launch(channel ? { channel } : {});
const page = await browser.newPage();

for (const icon of ICONS) {
  const dataUrl = await page.evaluate(
    async ({ source, icon, ball }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${source}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = icon.size;
      const g = canvas.getContext("2d")!;
      g.imageSmoothingQuality = "high";
      if (icon.background) {
        g.fillStyle = icon.background;
        g.fillRect(0, 0, icon.size, icon.size);
      }
      const r = (icon.size * icon.ballFraction) / 2;
      g.beginPath();
      g.arc(icon.size / 2, icon.size / 2, r, 0, Math.PI * 2);
      g.clip(); // only the ball - none of the screenshot's background or shadow
      g.drawImage(img, ball.cx - ball.r, ball.cy - ball.r, ball.r * 2, ball.r * 2, icon.size / 2 - r, icon.size / 2 - r, r * 2, r * 2);
      return canvas.toDataURL("image/png");
    },
    { source, icon, ball: BALL },
  );
  writeFileSync(outDir + icon.file, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`wrote ${icon.file}`);
}

await browser.close();
