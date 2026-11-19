// Shot mode for screenshots: ?shot=cover renders only the cover at the requested size, and
// ?shot=editor opens the editor with sample photos loaded and the panels filled (main.js builds
// the editor itself after applyShotQuery). Query params: layout, grade, size (WxH), photo (one
// sample name for every panel), photos (comma list per panel), caption, sub, badge, fill.
// window.__shotReady is set once the scene is painted.

import { renderCover } from './cover.js';

/** Parses a WxH size param, falling back to a square cover. */
export function parseShotSize(raw) {
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(raw || '');
  if (!match) return { w: 1080, h: 1080 };
  return { w: Number(match[1]), h: Number(match[2]) };
}

/** Applies the shot query's layout, grade, words and panel photos to the shared cover state. */
export function applyShotQuery(state, query) {
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('caption')) state.caption = query.get('caption');
  if (query.get('sub') !== null) state.sub = query.get('sub');
  if (query.get('badge')) state.badge = query.get('badge');
  if (query.get('fill')) state.titleFill = query.get('fill');
  const list = (query.get('photos') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const single = query.get('photo');
  state.panels.forEach((panel, i) => {
    if (list.length) panel.photoId = list[i % list.length];
    else if (single) panel.photoId = single;
  });
}

/** Marks the shot as painted after two animation frames, so screenshots capture the final pixels. */
export function signalShotReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/** Renders the cover-only shot: the preview canvas alone, at exactly the requested pixel size. */
export async function runCoverShot(query, env) {
  const { state, photos, loadSamplePhotos } = env;
  applyShotQuery(state, query);
  await loadSamplePhotos();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  document.body.classList.add('shot-cover');
  const { w, h } = parseShotSize(query.get('size'));
  const canvas = document.getElementById('preview');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), state, photos, w, h);
  signalShotReady();
}
