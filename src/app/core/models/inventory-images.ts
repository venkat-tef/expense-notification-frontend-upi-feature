/**
 * Inventory item images.
 *
 * Maps catalog item names to real photos bundled locally under
 * `src/assets/inventory/`. Angular already serves everything under
 * `src/assets` (see angular.json), so nothing else needs configuring —
 * just add the files listed below.
 *
 * ONE PHOTO PER GROUP, NOT PER ITEM:
 * Most items share representative photos (e.g. every whole spice-seed —
 * jeera, mustard, pepper, ajwain, coriander, fennel, poppy, sesame — uses
 * one "spice-seed.jpg"). This keeps the set sourceable/maintainable while
 * still giving each item card a relevant, real photo.
 *
 * EXTENSION (Indian / South Indian / Telugu vegetables & leafy greens):
 * The generic buckets below ("leafy-green", "veg-other", "capsicum",
 * "chilli", "banana", "garlic-ginger") used to lump many distinct Indian
 * vegetables together. This file now adds DEDICATED real-photo assets for
 * each of the commonly-needed Telugu/South-Indian household items (see the
 * new file list + the ADDED blocks in matchIconKey() below), while
 * leaving every original filename/key untouched so nothing that already
 * works can break.
 *
 * Same substring-matching approach as before — only the lookup table's
 * values and the matching rules changed/grew.
 *
 * FILES TO ADD (src/assets/inventory/), one real photo each, ideally
 * isolated on a white/transparent background:
 *
 * --- ORIGINAL (unchanged) ---
 *   tomato.jpg                onion.jpg               potato.jpg
 *   carrot.jpg                capsicum.jpg            chilli.jpg
 *   leafy-green.jpg           garlic-ginger.jpg       cucumber.jpg
 *   corn.jpg                  veg-other.jpg           lemon.jpg
 *   apple.jpg                 banana.jpg              citrus.jpg
 *   berry-fruit.jpg           milk.jpg                curd-yogurt.jpg
 *   butter-ghee-cheese.jpg    egg.jpg                 meat-fish.jpg
 *   coconut.jpg               bottle.jpg              rice-grain.jpg
 *   flour.jpg                 dal-pulse.jpg           spice-powder-red.jpg
 *   spice-powder-yellow.jpg   spice-seed.jpg          whole-spice.jpg
 *   salt.jpg                  sugar-jaggery-honey.jpg tea-coffee.jpg
 *   noodles-pasta.jpg         tamarind.jpg
 *
 * --- ADDED (new, per-item Telugu/South-Indian assets, .jpg) ---
 *   Leafy greens:
 *     drumstick-leaves.jpg   thotakura.jpg           gongura.jpg
 *     curry-leaves.jpg       coriander-leaves.jpg    mint-leaves.jpg
 *     spinach.jpg            methi-leaves.jpg
 *     (palak & amaranth-leaves are ALIASES, not new files — see below)
 *
 *   Common vegetables:
 *     drumstick.jpg          ivy-gourd.jpg           okra.jpg
 *     brinjal.jpg            bottle-gourd.jpg        ridge-gourd.jpg
 *     bitter-gourd.jpg       snake-gourd.jpg         ash-gourd.jpg
 *     pumpkin.jpg            cauliflower.jpg         broccoli.jpg
 *     cabbage.jpg            beetroot.jpg            radish.jpg
 *     turnip.jpg             mushroom.jpg            spring-onion.jpg
 *
 *   Beans:
 *     green-beans.jpg        cluster-beans.jpg       broad-beans.jpg
 *     peas.jpg
 *     (green-peas is an ALIAS of peas.jpg — same vegetable)
 *
 *   Root vegetables:
 *     sweet-potato.jpg       yam.jpg                 taro-root.jpg
 *     ginger.jpg             garlic.jpg
 *
 *   Chillies & peppers:
 *     green-chilli.jpg       red-chilli.jpg          red-chilli-dried.jpg
 *     capsicum-green.jpg     capsicum-red.jpg        capsicum-yellow.jpg
 *
 *   Other:
 *     raw-banana.jpg         raw-papaya.jpg
 *     (plantain is an ALIAS of raw-banana.jpg)
 *
 * NOTE: fridge-generic and kitchen-generic are NOT files — see below.
 *
 * File extension: original assets are written as .jpg, new ones as .jpg —
 * each path below is literal, so if you use a different extension for any
 * given file, just change that one line — nothing else needs to match.
 */

import { InventoryCategory } from './inventory.model';

const BASE = 'assets/inventory/';

/**
 * Inline fallback images (base64 SVG data URIs), NOT files under
 * src/assets/inventory/.
 *
 * Why inline instead of a jpg like everything else: these two are used
 * as the <img (error)> handler's target in onImageError() below — i.e.
 * they're what renders when a *real* photo is missing. If the fallback
 * itself were a file on disk, a missing/renamed fallback file would
 * 404, re-trigger the same error handler, get reassigned the same
 * (still-missing) fallback path, 404 again, forever — an infinite
 * request loop. A data URI can never 404, so the loop can't happen,
 * no matter what happens to the files on disk.
 */
const FRIDGE_GENERIC =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxOCIgZmlsbD0iI2Y2ZWRlMSIvPgo8dGV4dCB4PSIxMDAiIHk9IjEwMCIgZm9udC1zaXplPSI1NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiPvCfp4o8L3RleHQ+Cjx0ZXh0IHg9IjEwMCIgeT0iMTUyIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiIGxldHRlci1zcGFjaW5nPSIxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJyZ2JhKDAsMCwwLDAuNCkiPkZSSURHRTwvdGV4dD4KPC9zdmc+';

const KITCHEN_GENERIC =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj4KPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIHJ4PSIxOCIgZmlsbD0iI2YwZTZkMiIvPgo8dGV4dCB4PSIxMDAiIHk9IjEwMCIgZm9udC1zaXplPSI1NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiPvCfjbM8L3RleHQ+Cjx0ZXh0IHg9IjEwMCIgeT0iMTUyIiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiIGxldHRlci1zcGFjaW5nPSIxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJyZ2JhKDAsMCwwLDAuNCkiPktJVENIRU48L3RleHQ+Cjwvc3ZnPg==';

const IMAGES = {
  // --- ORIGINAL (unchanged) ---
  tomato: `${BASE}tomato.jpg`,
  onion: `${BASE}onion.jpg`,
  potato: `${BASE}potato.jpg`,
  carrot: `${BASE}carrot.jpg`,
  capsicum: `${BASE}capsicum.jpg`,
  chilli: `${BASE}chilli.jpg`,
  leafyGreen: `${BASE}leafy-green.jpg`,
  garlicGinger: `${BASE}garlic-ginger.jpg`,
  cucumber: `${BASE}cucumber.jpg`,
  corn: `${BASE}corn.jpg`,
  vegOther: `${BASE}veg-other.jpg`,
  lemon: `${BASE}lemon.jpg`,
  apple: `${BASE}apple.jpg`,
  banana: `${BASE}banana.jpg`,
  citrus: `${BASE}citrus.jpg`,
  berryFruit: `${BASE}berry-fruit.jpg`,
  milk: `${BASE}milk.jpg`,
  curdYogurt: `${BASE}curd-yogurt.jpg`,
  butterGheeCheese: `${BASE}butter-ghee-cheese.jpg`,
  egg: `${BASE}egg.jpg`,
  meatFish: `${BASE}meat-fish.jpg`,
  coconut: `${BASE}coconut.jpg`,
  bottle: `${BASE}bottle.jpg`,
  riceGrain: `${BASE}rice-grain.jpg`,
  flour: `${BASE}flour.jpg`,
  dalPulse: `${BASE}dal-pulse.jpg`,
  spicePowderRed: `${BASE}spice-powder-red.jpg`,
  spicePowderYellow: `${BASE}spice-powder-yellow.jpg`,
  spiceSeed: `${BASE}spice-seed.jpg`,
  wholeSpice: `${BASE}whole-spice.jpg`,
  salt: `${BASE}salt.jpg`,
  sugarJaggeryHoney: `${BASE}sugar-jaggery-honey.jpg`,
  teaCoffee: `${BASE}tea-coffee.jpg`,
  noodlesPasta: `${BASE}noodles-pasta.jpg`,
  tamarind: `${BASE}tamarind.jpg`,
  fridgeGeneric: FRIDGE_GENERIC,   // was: `${BASE}fridge-generic.jpg`
  kitchenGeneric: KITCHEN_GENERIC, // was: `${BASE}kitchen-generic.jpg`

  // --- ADDED: leafy greens ---
  drumstickLeaves: `${BASE}drumstick-leaves.jpg`,
  thotakura: `${BASE}thotakura.jpg`,           // also covers "amaranth leaves"
  gongura: `${BASE}gongura.jpg`,
  curryLeaves: `${BASE}curry-leaves.jpg`,
  corianderLeaves: `${BASE}coriander-leaves.jpg`,
  mintLeaves: `${BASE}mint-leaves.jpg`,
  spinach: `${BASE}spinach.jpg`,               // also covers "palak"
  methiLeaves: `${BASE}methi-leaves.jpg`,

  // --- ADDED: common vegetables ---
  drumstick: `${BASE}drumstick.jpg`,
  ivyGourd: `${BASE}ivy-gourd.jpg`,
  okra: `${BASE}okra.jpg`,
  brinjal: `${BASE}brinjal.jpg`,
  bottleGourd: `${BASE}bottle-gourd.jpg`,
  ridgeGourd: `${BASE}ridge-gourd.jpg`,
  bitterGourd: `${BASE}bitter-gourd.jpg`,
  snakeGourd: `${BASE}snake-gourd.jpg`,
  ashGourd: `${BASE}ash-gourd.jpg`,
  pumpkin: `${BASE}pumpkin.jpg`,
  cauliflower: `${BASE}cauliflower.jpg`,
  broccoli: `${BASE}broccoli.jpg`,
  cabbage: `${BASE}cabbage.jpg`,
  beetroot: `${BASE}beetroot.jpg`,
  radish: `${BASE}radish.jpg`,
  turnip: `${BASE}turnip.jpg`,
  mushroom: `${BASE}mushroom.jpg`,
  springOnion: `${BASE}spring-onion.jpg`,

  // --- ADDED: beans ---
  greenBeans: `${BASE}green-beans.jpg`,
  clusterBeans: `${BASE}cluster-beans.jpg`,
  broadBeans: `${BASE}broad-beans.jpg`,
  peas: `${BASE}peas.jpg`,                     // also covers "green peas"

  // --- ADDED: root vegetables ---
  sweetPotato: `${BASE}sweet-potato.jpg`,
  yam: `${BASE}yam.jpg`,
  taroRoot: `${BASE}taro-root.jpg`,
  ginger: `${BASE}ginger.jpg`,
  garlic: `${BASE}garlic.jpg`,

  // --- ADDED: chillies & peppers ---
  greenChilli: `${BASE}green-chilli.jpg`,
  redChilli: `${BASE}red-chilli.jpg`,
  redChilliDried: `${BASE}red-chilli-dried.jpg`,
  capsicumGreen: `${BASE}capsicum-green.jpg`,
  capsicumRed: `${BASE}capsicum-red.jpg`,
  capsicumYellow: `${BASE}capsicum-yellow.jpg`,
 mustard: `${BASE}mustard.jpg`,
cumin: `${BASE}cumin.jpg`,
drumstic: `${BASE}drumstic.jpg`,
whiteDal: `${BASE}white-dal.jpg`,

  // --- ADDED: other ---
  rawBanana: `${BASE}raw-banana.jpg`,           // also covers "plantain"
  rawPapaya: `${BASE}raw-papaya.jpg`,
} as const;

type IconKey = keyof typeof IMAGES;

// ==============================================================
// NAME -> IMAGE MATCHING
//
// Order matters: more specific rules run first so they "win" over the
// broader/generic rules that used to catch everything. Every ORIGINAL
// rule is preserved; ADDED blocks are marked so they're easy to spot
// against the previous version. Nothing existing was deleted — items
// that aren't covered by a new ADDED block still resolve exactly the
// way they did before.
// ==============================================================

function matchIconKey(rawName: string): IconKey | null {
  const name = rawName.toLowerCase().trim();

  // Vegetables
  if (name.includes('tomato') || name.includes('ketchup')) return 'tomato';

  // ADDED: Spring Onion / Green Onion — must be checked BEFORE the plain
  // "onion" rule below, since "spring onion" also contains "onion".
  if (name.includes('spring onion') || name.includes('green onion') || name.includes('scallion')) {
    return 'springOnion';
  }
  if (name.includes('onion')) return 'onion';

  // ADDED: Sweet Potato / Chilagadda — must be checked BEFORE the plain
  // "potato" rule below, since "sweet potato" also contains "potato".
  if (name.includes('sweet potato') || name.includes('chilagadda') || name.includes('chilkagadda')) {
    return 'sweetPotato';
  }
  if (name.includes('potato')) return 'potato';

  if (name.includes('carrot')) return 'carrot';

  // FIXED/EXPANDED: Capsicum now resolves to a color-specific photo when
  // the name says which color; falls back to the original generic
  // 'capsicum' photo when no color is specified (unchanged behavior).
  if (name.includes('capsicum') || name.includes('bell pepper')) {
    if (name.includes('red')) return 'capsicumRed';
    if (name.includes('yellow')) return 'capsicumYellow';
    if (name.includes('green')) return 'capsicumGreen';
    return 'capsicum';
  }

  // FIXED/EXPANDED: Chilli now resolves to green/red/dried-specific photos
  // when the name says which kind; falls back to the original generic
  // 'chilli' photo when unspecified (unchanged behavior). Powder still
  // wins first, exactly as before.
  if (
    name.includes('chilli') || name.includes('chili') || name.includes('mirchi') ||
    name.includes('mirapa') || name.includes('mirapakaya')
  ) {
    if (name.includes('powder')) return 'spicePowderRed';
    if (name.includes('dried') || name.includes('guntur') || name.includes('endu')) return 'redChilliDried';
    if (name.includes('red') || name.includes('erra')) return 'redChilli';
    if (name.includes('green') || name.includes('pachi') || name.includes('pacha')) return 'greenChilli';
    return 'chilli';
  }

  // ADDED: Cabbage now gets its own dedicated photo (previously lumped
  // into the generic leafy-green photo below).
  if (name.includes('cabbage')) return 'cabbage';

  // ADDED: dedicated Telugu/English leafy-green varieties. Each of these
  // used to fall into the single generic 'leafyGreen' photo — now each
  // gets its own real photo. Checked BEFORE the generic leafy-green
  // catch-all further down.
  if (
    name.includes('drumstick leaves') || name.includes('munagaaku') ||
    name.includes('munaga aaku') || name.includes('moringa leaves')
  ) return 'drumstickLeaves';
  if (name.includes('thotakura') || name.includes('amaranth')) return 'thotakura'; // amaranth leaves = thotakura
  if (name.includes('gongura') || name.includes('sorrel')) return 'gongura';
  if (
    name.includes('curry leaves') || name.includes('karivepaku') || name.includes('karivepakulu')
  ) return 'curryLeaves';
  if (
    name.includes('coriander leaves') || name.includes('kothimeera') || name.includes('kothimira')
  ) return 'corianderLeaves';
  if (name.includes('mint') || name.includes('pudina')) return 'mintLeaves';
  if (
    name.includes('methi leaves') || name.includes('menthi kura') || name.includes('menthikura') ||
    name.includes('fenugreek leaves')
  ) return 'methiLeaves';
  if (name.includes('palak') || name.includes('spinach')) return 'spinach'; // palak = Hindi for spinach

  // ORIGINAL generic leafy-green catch-all, now only reached for leafy
  // items that aren't one of the dedicated varieties above.
  if (name.includes('leafy') || name.includes('greens') || name.includes('saag')) return 'leafyGreen';

  // FIXED/EXPANDED: Garlic and Ginger now each get their own dedicated
  // photo. The combined "garlic-ginger" photo is still used, but only for
  // an explicit garlic+ginger combo (e.g. "Ginger Garlic Paste") so no
  // existing combo item changes appearance.
  if (
    (name.includes('garlic') && name.includes('ginger')) ||
    name.includes('ginger garlic') || name.includes('ginger-garlic')
  ) return 'garlicGinger';
  if (name.includes('ginger') || name.includes('allam')) return 'ginger';
  if (name.includes('garlic') || name.includes('vellulli') || name.includes('velluli')) return 'garlic';

  if (name.includes('cucumber')) return 'cucumber';
  if (name.includes('corn') && !name.includes('flour')) return 'corn';

  // ADDED: dedicated South-Indian/Telugu gourds & vegetables — each of
  // these previously fell into the generic 'vegOther' photo below.
  if (
    name.includes('drumstick') || name.includes('munagakaya') || name.includes('munagaya')
  ) return 'drumstick';
  if (name.includes('ivy gourd') || name.includes('tindora') || name.includes('dondakaya')) return 'ivyGourd';
  if (name.includes('okra') || name.includes('lady finger') || name.includes('bendakaya') || name.includes('bhindi')) {
    return 'okra';
  }
  if (name.includes('brinjal') || name.includes('eggplant') || name.includes('vankaya') || name.includes('baingan')) {
    return 'brinjal';
  }
  if (name.includes('bottle gourd') || name.includes('sorakaya') || name.includes('lauki')) return 'bottleGourd';
  if (name.includes('ridge gourd') || name.includes('beerakaya') || name.includes('turai')) return 'ridgeGourd';
  if (name.includes('bitter gourd') || name.includes('kakarakaya') || name.includes('karela')) return 'bitterGourd';
  if (name.includes('snake gourd') || name.includes('potlakaya')) return 'snakeGourd';
  if (
    name.includes('ash gourd') || name.includes('boodida gummadikaya') || name.includes('winter melon') ||
    name.includes('petha')
  ) return 'ashGourd';
  if (name.includes('pumpkin') || name.includes('gummadikaya') || name.includes('gummadi')) return 'pumpkin';
  if (name.includes('cauliflower') || name.includes('gobi')) return 'cauliflower';
  if (name.includes('broccoli')) return 'broccoli';
  if (name.includes('beetroot') || name.includes('beet')) return 'beetroot';
  if (name.includes('radish') || name.includes('mullangi')) return 'radish';
  if (name.includes('turnip')) return 'turnip';
  if (name.includes('mushroom')) return 'mushroom';

  // ADDED: beans — each of these previously fell into the generic
  // 'vegOther' photo below.
  if (
    name.includes('cluster beans') || name.includes('gorachikkudu') || name.includes('goru chikkudukaya')
  ) return 'clusterBeans';
  if (
    name.includes('broad beans') || name.includes('chikkudukaya') || name.includes('averakaya')
  ) return 'broadBeans';
  if (name.includes('green beans') || name.includes('french beans') || name.includes('beans')) return 'greenBeans';
  if (name.includes('green peas') || name.includes('peas') || name.includes('matar')) return 'peas';

  // ADDED: root vegetables — previously had no dedicated rule at all.
  if (name.includes('yam') || name.includes('kandagadda')) return 'yam';
  if (
    name.includes('taro') || name.includes('chamagadda') || name.includes('arbi') || name.includes('colocasia')
  ) return 'taroRoot';

  // ORIGINAL generic vegetable catch-all — kept as a true fallback for any
  // vegetable not covered by a dedicated rule above or below.
  if (name.includes('vegetable')) return 'vegOther';

  if (name.includes('lemon') || name.includes('lime')) return 'lemon';

  // Fruits
  if (name.includes('apple')) return 'apple';

  // FIXED/EXPANDED: raw/green banana and plantain (used as a vegetable in
  // Indian cooking) now get their own dedicated photo; ripe banana keeps
  // the original photo unchanged.
  if (name.includes('banana') || name.includes('plantain')) {
    if (
      name.includes('raw') || name.includes('plantain') || name.includes('aritikaya') ||
      name.includes('kaccha') || name.includes('green banana')
    ) return 'rawBanana';
    return 'banana';
  }

  // ADDED: raw/green papaya (used as a vegetable), checked BEFORE the
  // ripe-papaya rule inside the berry-fruit block below.
  if (
    (name.includes('papaya') && (name.includes('raw') || name.includes('green'))) ||
    name.includes('boppayi')
  ) return 'rawPapaya';

  if (name.includes('orange') || name.includes('mango')) return 'citrus';
  if (
    name.includes('grape') || name.includes('strawberry') ||
    name.includes('pomegranate') || name.includes('watermelon') ||
    name.includes('papaya') || name.includes('pineapple')
  ) return 'berryFruit';

  // Dairy
  if (name.includes('milk')) return 'milk';
  if (name.includes('curd') || name.includes('yogurt') || name.includes('yoghurt')) return 'curdYogurt';
  if (
    name.includes('butter') || name.includes('cheese') ||
    name.includes('paneer') || name.includes('cream') || name.includes('ghee')
  ) return 'butterGheeCheese';


  // Mustard / Awaalu
if (
  name.includes('mustard') ||
  name.includes('avalu') ||
  name.includes('awaalu') ||
  name.includes('avvalu')
) return 'mustard';

// Cumin / Jeera / Jilakara
if (
  name.includes('jeera') ||
  name.includes('cumin') ||
  name.includes('jeelakarra') ||
  name.includes('jilakara') ||
  name.includes('jeelakara')
) return 'cumin';


//drumstic
if (
  name.includes('mungakaya') ||
  name.includes('mulagakada') ||
  name.includes('drumstic') ||
  name.includes('mulaga kaada') ||
  name.includes('munga kaada')
) return 'drumstic';



  // Other fridge
  if (name.includes('egg')) return 'egg';
  // FIXED: was matching "Chicken Masala" / "Mutton Masala" / "Meat Masala" here
  // (a spice blend, no actual meat) before it ever reached the masala catch-all
  // below — showed a raw-meat photo on a spice-powder item. The `!masala` guard
  // lets those fall through to the masala rule instead.
  if (
    (name.includes('chicken') || name.includes('fish') || name.includes('mutton') || name.includes('meat')) &&
    !name.includes('masala')
  ) {
    return 'meatFish';
  }
  if (name.includes('coconut') && !name.includes('oil')) return 'coconut';
  if (
    name.includes('juice') || name.includes('water') ||
    name.includes('mayo') || name.includes('sauce') || name.includes('vinegar')
  ) return 'bottle';

  // Kitchen — grains
  if (name.includes('rice')) return 'riceGrain';
  if (
    name.includes('wheat') || name.includes('atta') || name.includes('maida') ||
    name.includes('rava') || name.includes('sooji') || name.includes('besan') ||
    name.includes('poha') || name.includes('oats') ||
    name.includes('corn flour') || name.includes('baking powder') || name.includes('baking soda')
  ) return 'flour';

  // Dals / pulses
  if (
  name.includes('whitedal') ||
  name.includes('white dal') ||
  name.includes('minapappu') ||
  name.includes('minapa pappu')
) {
  return 'whiteDal';
}
  if (
    name.includes('dal') || name.includes('pappu') || name.includes('lentil') ||
    name.includes('rajma') || name.includes('chickpea') || name.includes('chana') ||
    // ADDED: Green Gram / Pesalu, Chickpeas / Senagalu — had no rule at all before.
    name.includes('green gram') || name.includes('pesalu') || name.includes('senagalu')
  ) return 'dalPulse';



  // Spices
  if (name.includes('turmeric') || name.includes('pasupu') || name.includes('haldi')) return 'spicePowderYellow';
  if (
    name.includes('coriander powder') || name.includes('garam masala') ||
    name.includes('curry powder') || name.includes('sambar powder') ||
    name.includes('rasam powder') || name.includes('masala') ||
    // ADDED: Dhaniya Powder, Cumin Powder, Karam (Telugu for red chilli powder) —
    // checked here, BEFORE the seed-spice block below, so "cumin powder" resolves
    // to a powder photo instead of falling through to the cumin-seeds photo.
    name.includes('dhaniya powder') || name.includes('cumin powder') || name.includes('karam')
  ) return 'spicePowderRed';
  if (name.includes('hing') || name.includes('asafoetida') || name.includes('inguva')) return 'spicePowderYellow';
  if (
    name.includes('jeera') || name.includes('cumin') || name.includes('mustard') ||
    name.includes('avalu') || name.includes('pepper') || name.includes('fenugreek') ||
    name.includes('ajwain') ||
    // ADDED: Coriander Seeds / Dhaniyaalu / Dhaniya, Fennel Seeds / Sopu,
    // Poppy Seeds / Gasagasalu, Sesame Seeds / Nuvvulu, plus Telugu synonyms
    // for spices already covered above (Jeelakarra=cumin, Menthulu=fenugreek,
    // Miriyalu=pepper, Vaamu=ajwain). Safe to check "coriander"/"dhaniya" here
    // generically — coriander LEAVES and coriander/dhaniya POWDER both already
    // matched and returned earlier in this function, so anything reaching this
    // line is the seed.
    name.includes('coriander') || name.includes('dhaniyaalu') || name.includes('dhaniya') ||
    name.includes('fennel') || name.includes('sopu') ||
    name.includes('poppy') || name.includes('gasagasalu') ||
    name.includes('sesame') || name.includes('nuvvulu') ||
    name.includes('jeelakarra') || name.includes('menthulu') ||
    name.includes('miriyalu') || name.includes('vaamu')
  ) return 'spiceSeed';
  if (
    name.includes('cinnamon') || name.includes('clove') ||
    name.includes('cardamom') || name.includes('bay leaves') ||
    // ADDED: Telugu synonyms for whole spices already covered above.
    name.includes('lavangalu') || name.includes('dalchini') ||
    name.includes('elakulu') || name.includes('biriyani aaku')
  ) return 'wholeSpice';


  

  // Cooking essentials
  if (name.includes('salt')) return 'salt';
  if (name.includes('oil')) return 'bottle';




  // Tamarind — dedicated bucket. Previously "tamarind" was lumped into
  // sugarJaggeryHoney (a sweet-food photo), which is visually wrong for a sour
  // pulp/paste. Covers "Tamarind" and "Tamarind Paste" plus the Telugu name.
  if (name.includes('tamarind') || name.includes('chintapandu')) return 'tamarind';

  // Other pantry
  if (name.includes('sugar') || name.includes('jaggery') || name.includes('honey')) {
    return 'sugarJaggeryHoney';
  }
  if (name.includes('tea') || name.includes('coffee')) return 'teaCoffee';
  if (name.includes('noodles') || name.includes('pasta')) return 'noodlesPasta';

  return null;
}

// ==============================================================
// PUBLIC API
// ==============================================================

export function getInventoryItemImage(
  name: string,
  category: InventoryCategory
): string {

  const key = matchIconKey(name);

  if (key) {
    return IMAGES[key];
  }

  return getInventoryFallbackImage(category);
}

/**
 * Also used at runtime as the <img (error)> handler's target — if a
 * mapped file is ever missing/renamed, the card falls back to this
 * instead of showing a broken image icon. Always an inline data URI
 * (see FRIDGE_GENERIC / KITCHEN_GENERIC above) — never a file — so
 * this can never itself 404 and re-trigger the error handler.
 */
export function getInventoryFallbackImage(
  category: InventoryCategory
): string {

  return category === 'fridge'
    ? IMAGES.fridgeGeneric
    : IMAGES.kitchenGeneric;
}