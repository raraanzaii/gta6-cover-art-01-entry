// Panel Vice — a gta6-cover-art-01 entry (Node 22, standard library only).
// The app is this directory's app/ folder: plain static files a desktop browser loads offline
// (app/index.html and its ES modules, no library and no network request). This program hands it
// in: it copies app/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Panel Vice is a multi-panel GTA-style cover art studio: five layouts, five canvas colour
// grades, Anton/Pacifico lettering, decorations, and one-click PNG export at post sizes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- Improvement (Panel Vice): fail early with a clear message when the screenshots folder
// cannot pass the gate, instead of letting buildDossier fail later with a less obvious error.
// The gate allows 3-4 screenshots, each a whole PNG/JPEG of at most 262144 bytes; checking the
// count and sizes here keeps a broken local run from looking like a packaging bug.
function validateScreenshots(dir) {
  const names = readdirSync(dir)
    .filter((name) => !name.startsWith('.') && /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (names.length < 3 || names.length > 4) {
    throw new Error(`screenshots/: expected 3 or 4 images, found ${names.length} (${names.join(', ')})`);
  }
  for (const name of names) {
    const bytes = statSync(join(dir, name)).size;
    if (bytes > 262144) throw new Error(`screenshots/${name}: ${bytes} bytes, over the 262144 allowed`);
  }
  return names;
}

const screenshotNames = validateScreenshots(join(here, 'screenshots'));

// --- Improvement (Panel Vice, revision): also summarise the app tree itself. Walking app/ in
// sorted order and counting its files and bytes gives the log a second deterministic line, and
// it double-checks the gate's app caps (993 entries, 48 MiB) before buildDossier is asked to.
function summarizeAppTree(dir, prefix = '') {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      const sub = summarizeAppTree(path, `${prefix}${name}/`);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += stats.size;
    }
  }
  return { files, bytes };
}

const appSummary = summarizeAppTree(join(here, 'app'));
if (appSummary.files > 993 || appSummary.bytes > 50331648) {
  throw new Error(`app/: ${appSummary.files} files, ${appSummary.bytes} bytes — over the gate's app caps`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// --- Improvement (Panel Vice): print a deterministic summary of what was handed in — the
// screenshot names in order and the dossier size, with no timestamps or absolute paths — so two
// runs of this program can be compared byte for byte from their logs alone.
console.log(`handed in: ${screenshotNames.length} screenshots (${screenshotNames.join(', ')})`);
console.log(`app/: ${appSummary.files} files, ${appSummary.bytes} bytes`);
console.log(`dossier.json: ${statSync(join(out, 'dossier.json')).size} bytes`);
