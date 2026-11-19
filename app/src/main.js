// Panel Vice editor bootstrap: wires the control panel, the live preview canvas, photo loading,
// panel selection and dragging, undo/redo and PNG export. Shot mode lives in ./shots.js.
import {
  LAYOUTS, GRADES, getPhotoPanels, renderCover, exportCoverPng,
} from './cover.js';
import { applyShotQuery, runCoverShot, signalShotReady } from './shots.js';

export const SAMPLE_PHOTOS = [
  { id: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'pier', src: 'samples/pier.jpg', label: 'Pier' },
  { id: 'convertible', src: 'samples/convertible.jpg', label: 'Convertible' },
  { id: 'neonfriends', src: 'samples/neonfriends.jpg', label: 'Neon Friends' },
];

export const EXPORT_SIZES = [
  { w: 1080, h: 1080, label: 'Square 1080×1080' },
  { w: 1080, h: 1350, label: 'Portrait 1080×1350' },
  { w: 1920, h: 1080, label: 'Wide 1920×1080' },
  { w: 1080, h: 1920, label: 'Story 1080×1920' },
];

/** The editable cover state: layout, grade, words, decorations and one view per photo panel. */
export function createDefaultState() {
  return {
    layout: 'quad',
    grade: 'vice',
    caption: 'Vice Heat',
    sub: 'midnight boulevard stories',
    titleFill: 'gradient',
    badge: 'Vice City • Est. 2026',
    showBadge: true,
    heat: 4,
    showHeat: true,
    grain: true,
    vignette: true,
    panels: Array.from({ length: 9 }, (_, i) => ({
      photoId: SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length].id,
      zoom: 1, ox: 0, oy: 0,
    })),
  };
}

/** Loads an image from a local URL or object URL, resolving once it can be drawn. */
export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const state = createDefaultState();
const photos = new Map();
let selectedPanel = 0;
let exportSize = EXPORT_SIZES[0];
const undoStack = [];
const redoStack = [];

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

/** Snapshots the state for undo; called before every user-visible change settles. */
export function pushHistory() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}

function restoreHistory(json) {
  const next = JSON.parse(json);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
  syncControlsFromState();
  renderPreview();
}

function syncHistoryButtons() {
  const undo = document.getElementById('undo');
  const redo = document.getElementById('redo');
  if (undo) undo.disabled = undoStack.length === 0;
  if (redo) redo.disabled = redoStack.length === 0;
}

/** Sizes the preview canvas to the chosen export aspect and renders the cover into it. */
export function renderPreview() {
  const maxW = 920;
  const scale = Math.min(maxW / exportSize.w, 920 / exportSize.h);
  canvas.width = Math.round(exportSize.w * scale);
  canvas.height = Math.round(exportSize.h * scale);
  renderCover(ctx, state, photos, canvas.width, canvas.height);
  drawSelectionOutline();
}

/** Outlines the selected photo panel on the preview so dragging has a clear target. */
export function drawSelectionOutline() {
  const panels = getPhotoPanels(state.layout, canvas.width, canvas.height);
  const panel = panels[selectedPanel];
  if (!panel) return;
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  if (panel.rot) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.strokeRect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
  } else {
    ctx.strokeRect(panel.x + 2, panel.y + 2, panel.w - 4, panel.h - 4);
  }
  ctx.restore();
  const label = document.getElementById('selected-label');
  if (label) label.textContent = `Panel ${selectedPanel + 1} of ${panels.length}`;
  const zoom = document.getElementById('zoom');
  const view = state.panels[selectedPanel];
  if (zoom && view) zoom.value = String(view.zoom);
  const select = document.getElementById('panel-photo');
  if (select && view) select.value = view.photoId || '';
}

/** Rebuilds the photo picker options from every loaded photo (samples plus user uploads). */
export function refreshPhotoOptions() {
  const select = document.getElementById('panel-photo');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '';
  for (const [id, entry] of photos) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = entry.label;
    select.appendChild(opt);
  }
  const view = state.panels[selectedPanel];
  select.value = view && view.photoId ? view.photoId : current;
}

/** Loads the four bundled sample photos; they are local files and are never uploaded anywhere. */
export async function loadSamplePhotos() {
  for (const sample of SAMPLE_PHOTOS) {
    try {
      const img = await loadImageElement(sample.src);
      img.label = sample.label;
      photos.set(sample.id, img);
    } catch (err) {
      // A missing sample leaves its panels blank; the editor still works with user photos.
    }
  }
  refreshPhotoOptions();
}

/** Adds a user photo file, read locally as an object URL, and puts it in the selected panel. */
export async function addUserPhotoFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = await loadImageElement(url);
  const id = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  img.label = file.name.slice(0, 28);
  photos.set(id, img);
  pushHistory();
  state.panels[selectedPanel].photoId = id;
  refreshPhotoOptions();
  renderPreview();
  setStatus(`Added ${file.name} to panel ${selectedPanel + 1}.`);
}

function syncControlsFromState() {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
  const check = (id, value) => { const el = document.getElementById(id); if (el) el.checked = value; };
  set('caption', state.caption);
  set('sub', state.sub);
  set('badge', state.badge);
  set('heat', String(state.heat));
  set('title-fill', state.titleFill);
  check('show-badge', state.showBadge);
  check('show-heat', state.showHeat);
  check('grain', state.grain);
  check('vignette', state.vignette);
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  drawSelectionOutlineSoon();
}

function drawSelectionOutlineSoon() {
  requestAnimationFrame(() => drawSelectionOutline());
}

function buildChoiceButtons() {
  const layoutBox = document.getElementById('layout-buttons');
  for (const layout of LAYOUTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = layout.label;
    btn.dataset.layout = layout.id;
    if (layout.id === state.layout) btn.classList.add('active');
    btn.addEventListener('click', () => {
      pushHistory();
      state.layout = layout.id;
      selectedPanel = 0;
      syncControlsFromState();
      renderPreview();
    });
    layoutBox.appendChild(btn);
  }
  const gradeBox = document.getElementById('grade-buttons');
  for (const grade of GRADES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = grade.label;
    btn.dataset.grade = grade.id;
    if (grade.id === state.grade) btn.classList.add('active');
    btn.addEventListener('click', () => {
      pushHistory();
      state.grade = grade.id;
      syncControlsFromState();
      renderPreview();
    });
    gradeBox.appendChild(btn);
  }
  const exportBox = document.getElementById('export-buttons');
  for (const size of EXPORT_SIZES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `PNG ${size.label}`;
    btn.addEventListener('click', () => {
      exportSize = size;
      exportCoverPng(state, photos, size.w, size.h);
      setStatus(`Exported panel-vice-${size.w}x${size.h}.png`);
      renderPreview();
    });
    exportBox.appendChild(btn);
  }
  const aspectBox = document.getElementById('aspect-buttons');
  EXPORT_SIZES.forEach((size, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${size.w}×${size.h}`;
    if (i === 0) btn.classList.add('active');
    btn.addEventListener('click', () => {
      exportSize = size;
      aspectBox.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderPreview();
    });
    aspectBox.appendChild(btn);
  });
}

function bindTextControls() {
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('focus', () => pushHistory());
    el.addEventListener('input', () => {
      state[key] = el.value;
      renderPreview();
    });
  };
  bind('caption', 'caption');
  bind('sub', 'sub');
  bind('badge', 'badge');
  const bindCheck = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      pushHistory();
      state[key] = el.checked;
      renderPreview();
    });
  };
  bindCheck('show-badge', 'showBadge');
  bindCheck('show-heat', 'showHeat');
  bindCheck('grain', 'grain');
  bindCheck('vignette', 'vignette');
  const heat = document.getElementById('heat');
  if (heat) heat.addEventListener('input', () => { state.heat = Number(heat.value); renderPreview(); });
  if (heat) heat.addEventListener('change', () => pushHistory());
  const fill = document.getElementById('title-fill');
  if (fill) fill.addEventListener('change', () => { pushHistory(); state.titleFill = fill.value; renderPreview(); });
  const zoom = document.getElementById('zoom');
  if (zoom) zoom.addEventListener('input', () => {
    state.panels[selectedPanel].zoom = Number(zoom.value);
    renderPreview();
  });
  const photoSelect = document.getElementById('panel-photo');
  if (photoSelect) photoSelect.addEventListener('change', () => {
    pushHistory();
    state.panels[selectedPanel].photoId = photoSelect.value;
    renderPreview();
  });
  const fileInput = document.getElementById('photo-file');
  if (fileInput) fileInput.addEventListener('change', async () => {
    await addUserPhotoFile(fileInput.files[0]);
    fileInput.value = '';
  });
  const fillAll = document.getElementById('fill-all');
  if (fillAll) fillAll.addEventListener('click', () => {
    pushHistory();
    const id = state.panels[selectedPanel].photoId;
    state.panels.forEach((p) => { p.photoId = id; });
    renderPreview();
    setStatus('Every panel now uses the selected photo.');
  });
  const undo = document.getElementById('undo');
  if (undo) undo.addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(state));
    restoreHistory(undoStack.pop());
    syncHistoryButtons();
  });
  const redo = document.getElementById('redo');
  if (redo) redo.addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(state));
    restoreHistory(redoStack.pop());
    syncHistoryButtons();
  });
}

function bindCanvasPointer() {
  let dragging = null;
  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    const panels = getPhotoPanels(state.layout, canvas.width, canvas.height);
    let hit = -1;
    panels.forEach((panel, i) => {
      if (p.x >= panel.x && p.x <= panel.x + panel.w && p.y >= panel.y && p.y <= panel.y + panel.h) hit = i;
    });
    if (hit >= 0) selectedPanel = hit;
    dragging = { x: p.x, y: p.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
    renderPreview();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = pos(e);
    const view = state.panels[selectedPanel];
    const panels = getPhotoPanels(state.layout, canvas.width, canvas.height);
    const panel = panels[selectedPanel];
    if (!view || !panel) return;
    const dx = (p.x - dragging.x) / panel.w;
    const dy = (p.y - dragging.y) / panel.h;
    if (Math.abs(dx) + Math.abs(dy) > 0.001) {
      if (!dragging.moved) pushHistory();
      dragging.moved = true;
      view.ox = Math.max(-0.6, Math.min(0.6, view.ox + dx));
      view.oy = Math.max(-0.6, Math.min(0.6, view.oy + dy));
      dragging.x = p.x;
      dragging.y = p.y;
      renderPreview();
    }
  });
  canvas.addEventListener('pointerup', () => { dragging = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const view = state.panels[selectedPanel];
    if (!view) return;
    view.zoom = Math.max(1, Math.min(3, view.zoom + (e.deltaY < 0 ? 0.06 : -0.06)));
    renderPreview();
  }, { passive: false });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) await addUserPhotoFile(file);
  });
}

/** Entry point: a cover shot renders the cover alone; anything else builds the full editor. */
export async function startPanelVice() {
  const query = new URLSearchParams(location.search);
  if (query.get('shot') === 'cover') {
    await runCoverShot(query, { state, photos, loadSamplePhotos });
    return;
  }
  const isEditorShot = query.get('shot') === 'editor';
  if (isEditorShot) applyShotQuery(state, query);
  buildChoiceButtons();
  bindTextControls();
  bindCanvasPointer();
  syncControlsFromState();
  syncHistoryButtons();
  renderPreview();
  await loadSamplePhotos();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  if (isEditorShot) {
    // Honour the shot's export aspect for the preview, then flag the scene ready.
    const sizeParam = query.get('size');
    if (sizeParam) {
      const found = EXPORT_SIZES.find((s) => `${s.w}x${s.h}` === sizeParam);
      if (found) exportSize = found;
    }
    renderPreview();
    signalShotReady();
    return;
  }
  renderPreview();
  setStatus('Samples loaded. Pick a panel, drag to frame it, then export a PNG.');
}

startPanelVice();
