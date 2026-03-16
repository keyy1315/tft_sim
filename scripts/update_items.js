const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'public', 'data', 'tft_set16_items.json');
const RAW_PATH = path.join(__dirname, '..', 'raw-data', 'tft_ko_kr.json');
const IMAGES_ROOT = path.join(__dirname, '..', 'public', 'data', 'images');

// Load data
const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
const rawItems = raw.items || raw;

// ========== TASK 1: Add 10 missing artifact items ==========

// For items with duplicates, pick the preferred apiName
const preferredApiNames = {
  '거물의 갑옷': 'TFT7_Item_ShimmerscaleMogulsMail_Revival',
  '도박꾼의 칼날': 'TFT7_Item_ShimmerscaleGamblersBlade_Revival',
  '데마시아의 왕관': 'TFT9_Item_CrownOfDemacia',
  '무한한 삼위일체': 'TFT4_Item_OrnnInfinityForce',
  '선체분쇄자': 'TFT9_Item_OrnnHullbreaker',
  '저격수의 집중': 'TFT9_Item_OrnnHorizonFocus',
  '죽음의 저항': 'TFT4_Item_OrnnDeathsDefiance',
  '존야의 역설': 'TFT4_Item_OrnnZhonyasParadox',
  '따개비 장갑': 'TFT16_Item_Bilgewater_FreebootersFrock',
  '황금 징수의 총': 'TFT4_Item_OrnnTheCollector',
};

const targetNames = Object.keys(preferredApiNames);
const existingApiNames = new Set(data.items.map(i => i.apiName));

let addedCount = 0;
for (const name of targetNames) {
  const apiName = preferredApiNames[name];
  if (existingApiNames.has(apiName)) {
    console.log(`SKIP (already exists): ${name} (${apiName})`);
    continue;
  }

  const rawItem = rawItems.find(i => i.name === name && i.apiName === apiName);
  if (!rawItem) {
    console.log(`NOT FOUND in raw data: ${name} (${apiName})`);
    continue;
  }

  // Convert icon path: take last segment, lowercase, .tex -> .png
  const iconParts = rawItem.icon.split('/');
  const iconFilename = iconParts[iconParts.length - 1].toLowerCase().replace('.tex', '.png');

  const newItem = {
    name: rawItem.name,
    apiName: rawItem.apiName,
    composition: rawItem.composition || [],
    effects: rawItem.effects || {},
    desc: rawItem.desc || '',
    icon: iconFilename,
  };

  data.items.push(newItem);
  existingApiNames.add(apiName);
  addedCount++;
  console.log(`ADDED: ${name} -> ${iconFilename}`);
}

console.log(`\nTask 1: Added ${addedCount} artifact items.\n`);

// ========== TASK 2: Rename corrupted items from "XXX (찬란)" to "찬란한 XXX" ==========

let renamedCount = 0;
for (const item of data.items) {
  const match = item.name.match(/^(.+?)\s*\(찬란\)$/);
  if (match) {
    const oldName = item.name;
    item.name = `찬란한 ${match[1]}`;
    renamedCount++;
    console.log(`RENAMED: "${oldName}" -> "${item.name}"`);
  }
}

console.log(`\nTask 2: Renamed ${renamedCount} corrupted items.\n`);

// ========== TASK 3: Update meta.totalItems ==========

data.meta.totalItems = data.items.length;
console.log(`Updated meta.totalItems to ${data.items.length}`);

// ========== Save ==========

fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`\nSaved to ${DATA_PATH}`);

// ========== TASK 4: Check for broken icon paths ==========

console.log('\n========== BROKEN ICON CHECK ==========\n');

// Build a set of all image files across all image directories
const allImageFiles = new Set();
const imageDirs = ['artifacts', 'emblems', 'items', 'radiant', 'tft_set16_bilgewater', 'tft_set16_champions', 'tft_set16_piltover', 'traits'];

for (const dir of imageDirs) {
  const dirPath = path.join(IMAGES_ROOT, dir);
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    files.forEach(f => allImageFiles.add(f.toLowerCase()));
  }
}

let brokenCount = 0;
for (const item of data.items) {
  const icon = item.icon;
  if (!icon) {
    console.log(`NO ICON: ${item.name} (${item.apiName})`);
    brokenCount++;
    continue;
  }

  // The icon field is just a filename - check if it exists in any image dir
  const iconLower = icon.toLowerCase();
  if (!allImageFiles.has(iconLower)) {
    console.log(`BROKEN: ${item.name} (${item.apiName}) -> ${icon}`);
    brokenCount++;
  }
}

console.log(`\nTotal items with broken icons: ${brokenCount} / ${data.items.length}`);
