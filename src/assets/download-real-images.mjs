#!/usr/bin/env node
/**
 * download-real-images.mjs
 * ---------------------------------------------------------
 * Replaces the placeholder files in inventory-assets/ with
 * real photos, keeping your EXACT existing filenames so no
 * code changes are needed.
 *
 * Usage:
 *   node download-real-images.mjs                # writes .jpg (fast, no deps)
 *   node download-real-images.mjs --png           # also outputs true .png
 *                                                  # (requires: npm install sharp)
 *
 * Run this on YOUR machine (needs normal internet access to
 * img.spoonacular.com and, as a fallback, en.wikipedia.org /
 * upload.wikimedia.org). Point OUT_DIR below at your real
 * inventory-assets folder, or pass it as the first arg:
 *   node download-real-images.mjs ./src/assets/inventory-assets
 *
 * TWO-TIER SOURCING:
 *   1) Spoonacular ingredient-photo CDN (MAP below) — tried first,
 *      candidate slugs in order, exactly as before.
 *   2) Wikipedia REST summary API (WIKI_FALLBACK below) — tried ONLY
 *      if every Spoonacular candidate for that item fails. Spoonacular
 *      doesn't have every slug we guessed (e.g. plain "potato.jpg",
 *      "banana.jpg", "rice.jpg" 404 even though the ingredient
 *      obviously exists on their site under some other exact
 *      filename we can't know without their private slug list).
 *      Wikipedia almost always has a clean lead photo for standard
 *      vegetables/fruits/grains, so it's a solid safety net.
 *
 * If BOTH tiers fail for an item, the script reports it and keeps
 * your existing placeholder — safe to re-run any time.
 * ---------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "./inventory-assets";
const WANT_PNG = process.argv.includes("--png");

// filename (no ext) -> ordered list of candidate Spoonacular ingredient-photo
// slugs. Script tries each in order until one downloads successfully.
const MAP = {
  // --- ORIGINAL (unchanged) ---
  "apple":               ["apple", "red-apple"],
  "banana":               ["banana", "sliced-banana", "bananas", "ripe-banana"],
  "berry-fruit":          ["blueberries", "strawberries"],
  "bottle":               ["water-bottle", "vegetable-oil"],
  "butter-ghee-cheese":   ["butter", "cheddar"],
  "capsicum":             ["green-bell-pepper", "red-bell-pepper"],
  "carrot":               ["carrots", "carrot"],
  "chilli":               ["green-chili", "dried-red-chile-peppers", "chili-pepper", "red-chile-pepper"],
  "citrus":               ["orange", "lime"],
  "coconut":              ["coconut", "shredded-coconut"],
  "corn":                 ["corn", "corn-kernels"],
  "cucumber":             ["cucumber", "sliced-cucumber"],
  "curd-yogurt":          ["plain-yogurt", "milk"],
  "dal-pulse":            ["yellow-split-peas", "red-lentils"],
  "egg":                  ["egg", "eggs"],
  "flour":                ["flour", "all-purpose-flour"],
  "fridge-generic":       ["mixed-vegetables", "vegetable-tray"],
  "garlic-ginger":        ["garlic", "ginger"],
  "kitchen-generic":      ["spices", "herbs-and-spices"],
  "leafy-green":          ["spinach", "curry-leaves"],
  "lemon":                ["lemon", "lime"],
  "meat-fish":            ["raw-chicken-breast", "salmon"],
  "milk":                 ["milk", "milk-splash"],
  "noodles-pasta":        ["spaghetti", "noodles"],
  "onion":                ["red-onion", "onion"],
  "potato":               ["potatoes", "potato", "raw-potato", "yukon-gold-potato"],
  "rice-grain":           ["white-rice", "basmati-rice", "rice", "uncooked-rice"],
  "salt":                 ["salt", "sea-salt"],
  "spice-powder-red":     ["chili-powder", "paprika"],
  "spice-powder-yellow":  ["turmeric", "ground-turmeric"],
  "spice-seed":           ["cumin-seed", "mustard-seeds"],
  "sugar-jaggery-honey":  ["honey", "brown-sugar"],
  "tea-coffee":           ["coffee-beans", "black-tea"],
  "tomato":               ["tomato", "tomatoes"],
  "veg-other":            ["mixed-vegetables", "brinjal"],
  "whole-spice":          ["cinnamon-sticks", "cloves"],
  "tamarind":             ["tamarind", "tamarind-paste"],

  // --- ADDED: leafy greens ---
  "drumstick-leaves":     ["moringa-leaves", "spinach"],
  "thotakura":            ["amaranth-leaves", "spinach"],
  "gongura":              ["sorrel", "spinach"],
  "curry-leaves":         ["curry-leaves", "bay-leaves"],
  "coriander-leaves":     ["cilantro", "fresh-coriander"],
  "mint-leaves":          ["mint", "fresh-mint"],
  "spinach":              ["spinach", "baby-spinach"],
  "methi-leaves":         ["fenugreek-leaves", "spinach"],

  // --- ADDED: common vegetables ---
  "drumstick":            ["moringa-pods", "green-beans", "drumstick"],
  "ivy-gourd":            ["tindora", "cucumber"],
  "okra":                 ["okra", "fresh-okra"],
  "brinjal":              ["eggplant", "aubergine"],
  "bottle-gourd":         ["bottle-gourd", "zucchini"],
  "ridge-gourd":          ["ridge-gourd", "zucchini"],
  "bitter-gourd":         ["bitter-melon", "bitter-gourd"],
  "snake-gourd":          ["snake-gourd", "zucchini"],
  "ash-gourd":            ["winter-melon", "ash-gourd", "wax-gourd"],
  "pumpkin":              ["pumpkin", "butternut-squash"],
  "cauliflower":          ["cauliflower", "cauliflower-floret"],
  "broccoli":             ["broccoli", "broccoli-floret"],
  "cabbage":              ["cabbage", "green-cabbage"],
  "beetroot":             ["beet", "beetroot", "beets", "red-beet"],
  "radish":               ["radish", "daikon-radish", "radishes", "red-radish"],
  "turnip":               ["turnip", "turnips"],
  "mushroom":             ["white-mushrooms", "button-mushrooms", "mushrooms", "cremini-mushrooms"],
  "spring-onion":         ["spring-onions", "green-onions"],

  // --- ADDED: beans ---
  "green-beans":          ["green-beans", "string-beans", "green-bean", "french-green-beans"],
  "cluster-beans":        ["cluster-beans", "green-beans"],
  "broad-beans":          ["broad-beans", "fava-beans"],
  "peas":                 ["green-peas", "peas"],

  // --- ADDED: root vegetables ---
  "sweet-potato":         ["sweet-potato", "sweet-potatoes"],
  "yam":                  ["yam", "yams"],
  "taro-root":            ["taro-root", "taro"],
  "ginger":               ["ginger", "fresh-ginger-root"],
  "garlic":               ["garlic", "garlic-cloves"],

  // --- ADDED: chillies & peppers ---
  "green-chilli":         ["green-chili", "serrano-pepper"],
  "red-chilli":           ["red-chili-pepper", "fresno-pepper", "red-chili", "cayenne-pepper"],
  "red-chilli-dried":     ["dried-red-chile-peppers", "dried-chile-pepper", "dried-red-chili", "dried-chilies"],
  "capsicum-green":       ["green-bell-pepper", "green-pepper"],
  "capsicum-red":         ["red-bell-pepper", "red-pepper"],
  "capsicum-yellow":      ["yellow-bell-pepper", "yellow-pepper"],

  // --- ADDED: other ---
  "raw-banana":           ["green-banana", "plantain", "unripe-banana", "cooking-banana"],
  "raw-papaya":           ["green-papaya", "papaya"],
};

// filename (no ext) -> Wikipedia article title to use as a fallback image
// source ONLY when every Spoonacular candidate above fails for that item.
// Uses Wikipedia's REST summary endpoint, which returns a clean lead photo
// for essentially every standard vegetable/fruit/grain article.
const WIKI_FALLBACK = {
  "banana":               "Banana",
  "chilli":                "Chili pepper",
  "potato":               "Potato",
  "rice-grain":           "Rice",
  "drumstick":            "Moringa oleifera",
  "ash-gourd":            "Benincasa hispida",
  "beetroot":             "Beetroot",
  "radish":               "Radish",
  "mushroom":             "Edible mushroom",
  "green-beans":          "Green bean",
  "yam":                  "Yam (vegetable)",
  "red-chilli":           "Chili pepper",
  "red-chilli-dried":     "Chili pepper",
  "raw-banana":           "Cooking banana",
};

const SIZES = [250, 100]; // try bigger first, then smaller

async function tryDownload(slug) {
  for (const size of SIZES) {
    const url = `https://img.spoonacular.com/ingredients_${size}x${size}/${slug}.jpg`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) return buf; // reject tiny/broken responses
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

async function tryWikipedia(title) {
  try {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(summaryUrl, { headers: { "User-Agent": "inventory-image-downloader/1.0" } });
    if (!res.ok) return null;
    const data = await res.json();
    const imgUrl = data?.thumbnail?.source || data?.originalimage?.source;
    if (!imgUrl) return null;

    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > 500) return buf;
  } catch (_) { /* fall through */ }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let sharp = null;
  if (WANT_PNG) {
    try { sharp = (await import("sharp")).default; }
    catch { console.warn("⚠️  --png requested but `sharp` isn't installed. Run: npm install sharp\n   Falling back to .jpg output.\n"); }
  }

  let ok = 0, fail = 0, wikiUsed = 0;
  for (const [name, slugs] of Object.entries(MAP)) {
    let buf = null, usedSlug = null;

    for (const slug of slugs) {
      buf = await tryDownload(slug);
      if (buf) { usedSlug = slug; break; }
    }

    // Tier 2: Wikipedia, only if Spoonacular came up empty and a fallback
    // title is defined for this item.
    if (!buf && WIKI_FALLBACK[name]) {
      buf = await tryWikipedia(WIKI_FALLBACK[name]);
      if (buf) { usedSlug = `wikipedia:${WIKI_FALLBACK[name]}`; wikiUsed++; }
    }

    if (!buf) {
      console.log(`✕ ${name} — no candidate photo found (${slugs.join(", ")}${WIKI_FALLBACK[name] ? `, wikipedia:${WIKI_FALLBACK[name]}` : ""})`);
      fail++;
      continue;
    }

    if (sharp) {
      const outPath = path.join(OUT_DIR, `${name}.png`);
      await sharp(buf).png().toFile(outPath);
      console.log(`✓ ${name}.png  (source: ${usedSlug})`);
    } else {
      const outPath = path.join(OUT_DIR, `${name}.jpg`);
      fs.writeFileSync(outPath, buf);
      console.log(`✓ ${name}.jpg  (source: ${usedSlug})`);
    }
    ok++;
  }

  console.log(`\nDone: ${ok} downloaded (${wikiUsed} via Wikipedia fallback), ${fail} failed.`);
  if (fail) console.log("Failed ones keep your existing placeholder — safe to re-run the script any time.");
}

main();
