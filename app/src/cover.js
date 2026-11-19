// Panel Vice cover engine: layouts, colour grades, lettering and decorations drawn on canvas 2D.
// Everything here is original code and original design; the typefaces are the open-licensed Anton
// and Pacifico files bundled under app/fonts/.

export const LAYOUTS = [
  { id: 'full', label: 'Full Bleed', panels: 1 },
  { id: 'quad', label: 'Quad Grid', panels: 4 },
  { id: 'hero', label: 'Hero & Three', panels: 4 },
  { id: 'nine', label: 'Nine Panel', panels: 8 },
  { id: 'trio', label: 'Snapshot Trio', panels: 3 },
];

export const GRADES = [
  { id: 'vice', label: 'Vice Sunset' },
  { id: 'neon', label: 'Neon Nights' },
  { id: 'teal', label: 'Teal Heat' },
  { id: 'flamingo', label: 'Flamingo Candy' },
  { id: 'noir', label: 'Noir Ink' },
];

const GRADE_STOPS = {
  vice: [[26, 11, 46], [123, 45, 139], [232, 78, 138], [255, 154, 92], [255, 232, 176]],
  neon: [[5, 5, 22], [20, 32, 94], [14, 124, 158], [255, 46, 154], [184, 255, 241]],
  teal: [[2, 24, 28], [6, 90, 96], [42, 157, 143], [244, 162, 97], [255, 232, 194]],
  flamingo: [[46, 10, 30], [194, 24, 91], [255, 107, 157], [255, 179, 200], [255, 240, 245]],
  noir: [[8, 8, 10], [52, 52, 58], [128, 128, 134], [208, 208, 214], [248, 248, 250]],
};

const GRADE_TUNING = {
  vice: { saturation: 1.25, contrast: 1.12, strength: 0.52, posterize: 0 },
  neon: { saturation: 1.35, contrast: 1.18, strength: 0.58, posterize: 0 },
  teal: { saturation: 1.15, contrast: 1.1, strength: 0.5, posterize: 0 },
  flamingo: { saturation: 1.3, contrast: 1.05, strength: 0.5, posterize: 0 },
  noir: { saturation: 0.0, contrast: 1.3, strength: 0.92, posterize: 5 },
};

/** Builds a 256-entry per-channel lookup table for a grade by interpolating its gradient stops. */
export function buildGradeLookup(gradeId) {
  const stops = GRADE_STOPS[gradeId] || GRADE_STOPS.vice;
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const a = Math.min(stops.length - 2, Math.floor(t));
    const f = t - a;
    for (let c = 0; c < 3; c++) {
      lut[i * 3 + c] = Math.round(stops[a][c] + (stops[a + 1][c] - stops[a][c]) * f);
    }
  }
  return lut;
}

/** Applies contrast, saturation, an optional posterize step and the gradient map to image data. */
export function applyGradientMapGrade(imageData, gradeId) {
  const tune = GRADE_TUNING[gradeId] || GRADE_TUNING.vice;
  const lut = buildGradeLookup(gradeId);
  const d = imageData.data;
  const { saturation, contrast, strength, posterize } = tune;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    r = (r - 0.5) * contrast + 0.5;
    g = (g - 0.5) * contrast + 0.5;
    b = (b - 0.5) * contrast + 0.5;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;
    if (posterize > 1) {
      const step = posterize - 1;
      r = Math.round(Math.max(0, Math.min(1, r)) * step) / step;
      g = Math.round(Math.max(0, Math.min(1, g)) * step) / step;
      b = Math.round(Math.max(0, Math.min(1, b)) * step) / step;
    }
    const li = Math.max(0, Math.min(255, Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 255))) * 3;
    const keep = 1 - strength;
    d[i] = Math.max(0, Math.min(255, (r * 255) * keep + lut[li] * strength));
    d[i + 1] = Math.max(0, Math.min(255, (g * 255) * keep + lut[li + 1] * strength));
    d[i + 2] = Math.max(0, Math.min(255, (b * 255) * keep + lut[li + 2] * strength));
  }
  return imageData;
}

/** Panel rectangles in pixels for a layout at a given cover size. A panel may carry rot (degrees) or titleBlock. */
export function getLayoutPanels(layoutId, width, height) {
  const W = width, H = height;
  const cell = (x, y, w, h, extra) => Object.assign({ x: x * W, y: y * H, w: w * W, h: h * H }, extra || {});
  if (layoutId === 'full') return [cell(0, 0, 1, 1)];
  if (layoutId === 'hero') {
    return [
      cell(0, 0, 0.62, 1),
      cell(0.62, 0, 0.38, 1 / 3),
      cell(0.62, 1 / 3, 0.38, 1 / 3),
      cell(0.62, 2 / 3, 0.38, 1 / 3),
    ];
  }
  if (layoutId === 'nine') {
    const out = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const isCenter = row === 1 && col === 1;
        out.push(cell(col / 3, row / 3, 1 / 3, 1 / 3, isCenter ? { titleBlock: true } : {}));
      }
    }
    return out;
  }
  if (layoutId === 'trio') {
    return [
      { x: 0.03 * W, y: 0.06 * H, w: 0.54 * W, h: 0.66 * H, rot: -6 },
      { x: 0.45 * W, y: 0.03 * H, w: 0.52 * W, h: 0.6 * H, rot: 5 },
      { x: 0.27 * W, y: 0.42 * H, w: 0.5 * W, h: 0.55 * H, rot: -2 },
    ];
  }
  return [cell(0, 0, 0.5, 0.5), cell(0.5, 0, 0.5, 0.5), cell(0, 0.5, 0.5, 0.5), cell(0.5, 0.5, 0.5, 0.5)];
}

/** Photo panels only (the nine layout's title block is not a photo panel), in drawing order. */
export function getPhotoPanels(layoutId, width, height) {
  return getLayoutPanels(layoutId, width, height).filter((p) => !p.titleBlock);
}

function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scratchCanvas = () => document.createElement('canvas');

/** Draws one photo into a panel rect with cover-fit, the panel view's zoom and offset, then grades it. */
export function drawPanelPhoto(ctx, panel, image, view, gradeId) {
  const pw = Math.max(2, Math.round(panel.w));
  const ph = Math.max(2, Math.round(panel.h));
  const tmp = scratchCanvas();
  tmp.width = pw; tmp.height = ph;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#241433';
  tctx.fillRect(0, 0, pw, ph);
  if (image) {
    const zoom = view && view.zoom ? view.zoom : 1;
    const scale = Math.max(pw / image.naturalWidth, ph / image.naturalHeight) * zoom;
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const ox = view ? view.ox || 0 : 0;
    const oy = view ? view.oy || 0 : 0;
    tctx.drawImage(image, (pw - dw) / 2 + ox * pw, (ph - dh) / 2 + oy * ph, dw, dh);
  }
  try {
    const data = tctx.getImageData(0, 0, pw, ph);
    tctx.putImageData(applyGradientMapGrade(data, gradeId), 0, 0);
  } catch (err) {
    // A tainted or unreadable photo still shows ungraded rather than failing the whole cover.
  }
  ctx.save();
  if (panel.rot) {
    const cx = panel.x + panel.w / 2, cy = panel.y + panel.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.shadowColor = 'rgba(10, 2, 20, 0.55)';
    ctx.shadowBlur = Math.max(10, pw * 0.04);
    ctx.shadowOffsetY = Math.max(6, ph * 0.02);
    ctx.drawImage(tmp, -panel.w / 2, -panel.h / 2, panel.w, panel.h);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = Math.max(6, pw * 0.035);
    ctx.strokeStyle = '#fff6ea';
    ctx.strokeRect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  ctx.drawImage(tmp, panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
}

/** Draws the halftone title block used at the centre of the Nine Panel layout. */
export function drawHalftoneTitleBlock(ctx, panel, state) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  ctx.fillStyle = '#1b0f2e';
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  const spacing = Math.max(9, panel.w * 0.045);
  ctx.fillStyle = 'rgba(255, 110, 160, 0.28)';
  for (let y = panel.y + spacing / 2, row = 0; y < panel.y + panel.h; y += spacing, row++) {
    for (let x = panel.x + spacing / 2 + (row % 2 ? spacing / 2 : 0); x < panel.x + panel.w; x += spacing) {
      const r = spacing * 0.16 * (0.6 + 0.4 * Math.sin((x + y) * 0.02));
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawFittedCaption(ctx, state, panel.x + panel.w / 2, panel.y + panel.h / 2, panel.w * 0.88, panel.h * 0.62, true);
  ctx.restore();
}

/** Fits caption words into up to three centred lines inside maxWidth, shrinking the Anton size until they fit. */
export function fitCaptionLines(ctx, text, maxWidth, startSize) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], size: startSize };
  let size = startSize;
  for (; size > 10; size -= 2) {
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= 3 && widest <= maxWidth) return { lines, size };
  }
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  return { lines: [words.join(' ')], size };
}

function captionFillStyle(ctx, state, y, size) {
  if (state.titleFill === 'neon') return '#ff2e9a';
  if (state.titleFill === 'white') return '#ffffff';
  const grad = ctx.createLinearGradient(0, y - size, 0, y + size * 0.3);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.55, '#ff7b54');
  grad.addColorStop(1, '#ff2e88');
  return grad;
}

/** Draws already-fitted caption lines centred at (cx, cy) with outline, shadow and the chosen fill. */
export function drawCaptionLines(ctx, state, lines, size, cx, cy, inBlock) {
  const lineHeight = size * 1.04;
  const total = lineHeight * lines.length;
  let y = cy - total / 2 + size * 0.82;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  ctx.lineJoin = 'round';
  if (state.titleFill === 'neon') {
    ctx.shadowColor = '#ff2e9a';
    ctx.shadowBlur = size * 0.35;
  } else {
    ctx.shadowColor = 'rgba(16, 2, 28, 0.65)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.05;
  }
  for (const line of lines) {
    ctx.lineWidth = size * (inBlock ? 0.14 : 0.18);
    ctx.strokeStyle = '#160722';
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = captionFillStyle(ctx, state, y, size);
    ctx.fillText(line, cx, y);
    y += lineHeight;
  }
  ctx.restore();
  return total;
}

/** Draws the fitted caption lines centred at (cx, cy); used by the title block and the main title. */
export function drawFittedCaption(ctx, state, cx, cy, maxWidth, maxHeight, inBlock) {
  const text = (state.caption || '').trim();
  if (!text) return 0;
  const start = Math.min(maxHeight * 0.52, maxWidth * 0.24);
  const { lines, size } = fitCaptionLines(ctx, text, maxWidth, start);
  return drawCaptionLines(ctx, state, lines, size, cx, cy, inBlock);
}

/** Measures the main foot caption: fitted lines, size, and the block's top and bottom edges. */
export function measureCoverTitle(ctx, state, width, height) {
  const text = (state.caption || '').trim();
  if (!text) return null;
  const start = Math.min(height * 0.156, width * 0.92 * 0.24);
  const { lines, size } = fitCaptionLines(ctx, text, width * 0.92, start);
  const total = lines.length * size * 1.04;
  const bottom = height * 0.972;
  return { lines, size, total, bottom, top: bottom - total };
}

/** Draws the main caption anchored to the foot of the cover, above a soft dark scrim. */
export function drawCoverTitle(ctx, state, width, height) {
  const metrics = measureCoverTitle(ctx, state, width, height);
  if (!metrics) return;
  const scrimTop = Math.min(height * 0.62, metrics.top - height * 0.08);
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, height);
  scrim.addColorStop(0, 'rgba(12, 2, 22, 0)');
  scrim.addColorStop(1, 'rgba(12, 2, 22, 0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, width, height - scrimTop);
  drawCaptionLines(ctx, state, metrics.lines, metrics.size, width / 2, metrics.top + metrics.total / 2, false);
}

/** Draws the script subtitle in Pacifico with a neon glow, just above the main caption. */
export function drawCoverSubtitle(ctx, state, width, height) {
  const text = (state.sub || '').trim();
  if (!text) return;
  let size = height * 0.045;
  ctx.save();
  ctx.textAlign = 'center';
  for (; size > 10; size -= 1) {
    ctx.font = `${size}px Pacifico, cursive`;
    if (ctx.measureText(text).width <= width * 0.8) break;
  }
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = size * 0.5;
  ctx.lineWidth = size * 0.14;
  ctx.strokeStyle = 'rgba(14, 4, 30, 0.85)';
  let y = height * 0.965;
  if (state.layout !== 'nine') {
    const metrics = measureCoverTitle(ctx, state, width, height);
    y = metrics ? metrics.top - size * 0.3 : height * 0.745;
  }
  // measureCoverTitle leaves the Anton caption font on the context, so set the script font last.
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.strokeText(text, width / 2, y);
  ctx.fillStyle = '#a5f3fc';
  ctx.fillText(text, width / 2, y);
  ctx.restore();
}

/** Draws the five-star heat meter at the top right of the cover. */
export function drawHeatStars(ctx, state, width, height) {
  if (!state.showHeat) return;
  const heat = Math.max(0, Math.min(5, Math.round(state.heat || 0)));
  const r = Math.max(9, height * 0.017);
  const gap = r * 2.5;
  const cy = height * 0.085;
  let cx = width - width * 0.035 - gap * 4 - r;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI) / 5;
      const rad = k % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.strokeStyle = '#160722';
    if (i < heat) {
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = 'rgba(255, 170, 40, 0.8)';
      ctx.shadowBlur = r * 0.5;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.stroke();
    cx += gap;
  }
  ctx.restore();
}

/** Draws the ribbon badge bar across the very top of the cover. */
export function drawRibbonBadge(ctx, state, width, height) {
  const text = (state.badge || '').trim();
  if (!state.showBadge || !text) return;
  const barH = Math.max(22, height * 0.042);
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#ff2e88');
  grad.addColorStop(0.5, '#ff7b54');
  grad.addColorStop(1, '#ffd23f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, barH);
  ctx.fillStyle = 'rgba(22, 7, 34, 0.9)';
  ctx.fillRect(0, barH, width, Math.max(2, height * 0.004));
  let size = barH * 0.52;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (; size > 8; size -= 1) {
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    if (ctx.measureText(text.toUpperCase()).width <= width * 0.86) break;
  }
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(22, 7, 34, 0.45)';
  ctx.shadowBlur = size * 0.18;
  ctx.fillText(text.toUpperCase(), width / 2, barH * 0.54);
  ctx.restore();
}

/** Adds deterministic film grain over the whole cover. */
export function applyFilmGrain(ctx, width, height) {
  const tile = 180;
  const noise = scratchCanvas();
  noise.width = tile; noise.height = tile;
  const nctx = noise.getContext('2d');
  const data = nctx.createImageData(tile, tile);
  const rand = seededRandom(20260);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v;
    data.data[i + 3] = 22;
  }
  nctx.putImageData(data, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(noise, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

/** Darkens the cover edges with a soft vignette. */
export function applyVignette(ctx, width, height) {
  const radius = Math.hypot(width, height) / 2;
  const grad = ctx.createRadialGradient(width / 2, height / 2, radius * 0.45, width / 2, height / 2, radius);
  grad.addColorStop(0, 'rgba(8, 0, 16, 0)');
  grad.addColorStop(1, 'rgba(8, 0, 16, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/** Draws the sunset backdrop that sits behind the Snapshot Trio panels. */
export function drawTrioBackdrop(ctx, width, height) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#2b1055');
  grad.addColorStop(0.55, '#a4137c');
  grad.addColorStop(1, '#ff7b54');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/** Draws every panel of the layout, its borders and the title block. */
export function drawPanelGrid(ctx, state, photos, width, height) {
  if (state.layout === 'trio') drawTrioBackdrop(ctx, width, height);
  else {
    ctx.fillStyle = '#160722';
    ctx.fillRect(0, 0, width, height);
  }
  const panels = getLayoutPanels(state.layout, width, height);
  let photoIndex = 0;
  for (const panel of panels) {
    if (panel.titleBlock) {
      drawHalftoneTitleBlock(ctx, panel, state);
      continue;
    }
    const view = state.panels[photoIndex] || { photoId: null, zoom: 1, ox: 0, oy: 0 };
    const image = view.photoId ? photos.get(view.photoId) : null;
    drawPanelPhoto(ctx, panel, image || null, view, state.grade);
    photoIndex++;
  }
  if (state.layout !== 'trio') {
    ctx.save();
    ctx.strokeStyle = '#fff6ea';
    ctx.lineWidth = Math.max(5, width * 0.007);
    for (const panel of panels) ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
    ctx.lineWidth = Math.max(8, width * 0.011);
    ctx.strokeRect(0, 0, width, height);
    ctx.restore();
  }
}

/** Renders the complete cover onto a 2D context at the given size. */
export function renderCover(ctx, state, photos, width, height) {
  ctx.clearRect(0, 0, width, height);
  drawPanelGrid(ctx, state, photos, width, height);
  if (state.layout !== 'nine') drawCoverTitle(ctx, state, width, height);
  drawCoverSubtitle(ctx, state, width, height);
  drawRibbonBadge(ctx, state, width, height);
  drawHeatStars(ctx, state, width, height);
  if (state.grain) applyFilmGrain(ctx, width, height);
  if (state.vignette) applyVignette(ctx, width, height);
}

/** Renders the cover to a fresh full-resolution canvas, ready for export or a screenshot. */
export function renderCoverCanvas(state, photos, width, height) {
  const canvas = scratchCanvas();
  canvas.width = width;
  canvas.height = height;
  renderCover(canvas.getContext('2d'), state, photos, width, height);
  return canvas;
}

/** Exports the cover as a PNG download at the requested pixel size. */
export function exportCoverPng(state, photos, width, height) {
  const canvas = renderCoverCanvas(state, photos, width, height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `panel-vice-${width}x${height}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }, 'image/png');
}
