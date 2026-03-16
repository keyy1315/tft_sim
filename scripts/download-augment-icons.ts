import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const AUGMENTS_PATH = path.resolve(__dirname, '../public/data/tft_set16_augments.json');
const OUTPUT_DIR = path.resolve(__dirname, '../public/images/augments');
const CONCURRENCY = 5;

interface RawAugment {
  name: string;
  apiName: string;
  icon: string;
}

function iconToUrl(icon: string): string {
  // ASSETS/Maps/TFT/Icons/Augments/Hexcore/Xxx.TFT_Set16.tex
  // → https://raw.communitydragon.org/latest/game/assets/maps/tft/icons/augments/hexcore/xxx.tft_set16.png
  const lower = icon.toLowerCase().replace('.tex', '.png');
  return `https://raw.communitydragon.org/latest/game/${lower}`;
}

function iconToFilename(icon: string): string {
  const parts = icon.split('/');
  return parts[parts.length - 1].toLowerCase().replace('.tex', '.png');
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        if (res.headers.location) {
          download(res.headers.location, dest).then(resolve).catch(reject);
        } else {
          reject(new Error(`Redirect without location: ${url}`));
        }
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  const data = JSON.parse(fs.readFileSync(AUGMENTS_PATH, 'utf-8'));
  const augments: RawAugment[] = data.augments;

  // Extract unique icons
  const iconSet = new Map<string, string>();
  for (const aug of augments) {
    if (!aug.icon) continue;
    const filename = iconToFilename(aug.icon);
    if (!iconSet.has(filename)) {
      iconSet.set(filename, aug.icon);
    }
  }

  console.log(`Found ${iconSet.size} unique augment icons to download`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const entries = Array.from(iconSet.entries());
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async ([filename, icon]) => {
      const dest = path.join(OUTPUT_DIR, filename);
      if (fs.existsSync(dest)) {
        skipped++;
        return;
      }
      try {
        const url = iconToUrl(icon);
        await download(url, dest);
        downloaded++;
      } catch (err) {
        failed++;
        console.error(`Failed: ${filename} - ${(err as Error).message}`);
      }
    }));
    process.stdout.write(`\r  Progress: ${Math.min(i + CONCURRENCY, entries.length)}/${entries.length}`);
  }

  console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(console.error);
