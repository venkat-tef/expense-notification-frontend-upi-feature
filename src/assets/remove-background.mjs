/**
 * Add this near your other imports at the top of the script:
 *   import sharp from "sharp";   // npm install sharp
 *
 * Then replace your current "save as png" step with removeWhiteBackground()
 * below before writing the file. Full usage shown at the bottom.
 */

/**
 * Makes near-white pixels transparent. Works well for the Spoonacular
 * ingredient photos (clean white/off-white studio background) — not a
 * general-purpose subject segmenter, so it can leave a faint halo on
 * fuzzy edges (e.g. cilantro, coconut shavings) and won't help if the
 * item itself is white (rice, salt, coconut flesh). See the ML-based
 * alternative below for those.
 *
 * @param {Buffer} inputBuffer - raw downloaded image (jpg/png)
 * @param {object} opts
 * @param {number} opts.threshold - 0-255, how close to white counts as
 *   background. Lower = only pure white removed (safer, may leave a
 *   ring). Higher = more aggressive (risk of eating into light-colored
 *   food, e.g. garlic, coconut, rice). 235-245 is a good starting range.
 * @param {number} opts.feather - 0-40, softens the cutout edge so it
 *   isn't a hard jagged line. 8-15 looks natural.
 * @returns {Promise<Buffer>} PNG buffer with alpha transparency
 */
async function removeWhiteBackground(inputBuffer, opts = {}) {
  const { threshold = 240, feather = 10 } = opts;

  const img = sharp(inputBuffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const isBackground = r >= threshold && g >= threshold && b >= threshold;

    if (isBackground) {
      data[i + 3] = 0; // fully transparent
    } else {
      // distance from threshold gives a soft edge instead of a hard cutoff
      const brightness = (r + g + b) / 3;
      if (brightness > threshold - feather) {
        const t = (threshold - brightness) / feather; // 0..1
        data[i + 3] = Math.round(255 * Math.min(1, Math.max(0, t)));
      }
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Drop-in replacement for the "write file" step in your existing script.
 * Example usage inside your main() loop, after you already have `buf`
 * (the downloaded photo bytes) and before writing to disk:
 */
async function saveTransparentPng(buf, outPath) {
  const transparentBuf = await removeWhiteBackground(buf, {
    threshold: 240,
    feather: 10,
  });
  fs.writeFileSync(outPath, transparentBuf);
}

/**
 * ---------------------------------------------------------------
 * If the simple white-cutout leaves visible halos on an item (common
 * with anything fuzzy/thin: curry leaves, coconut shreds, whole spices
 * with thin stems), swap to real ML background removal instead. It's
 * heavier (downloads a small model on first run) but segments the
 * actual subject rather than keying on color:
 *
 *   npm install @imgly/background-removal-node
 *
 *   import { removeBackground } from "@imgly/background-removal-node";
 *
 *   async function saveTransparentPngML(buf, outPath) {
 *     const blob = await removeBackground(buf);
 *     const arrayBuf = await blob.arrayBuffer();
 *     fs.writeFileSync(outPath, Buffer.from(arrayBuf));
 *   }
 *
 * Same call signature as saveTransparentPng — you can try the fast
 * version first and only fall back to this for specific items that
 * look bad.
 * ---------------------------------------------------------------
 */
