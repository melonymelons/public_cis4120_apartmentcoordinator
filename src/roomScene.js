// Keep the furniture from the original illustration, but render the floor once
// across the entire room. There is no original-image edge to join to a new floor.
const rooms = {
  living: { floorY: 130, wall: [373, 25], floor: [15, 398, 288, 74], props: [[12, 88, 73, 65], [258, 14, 111, 145], [18, 157, 72, 116], [98, 167, 178, 154], [275, 153, 98, 178]] },
  bedroom: { floorY: 171, wall: [20, 20], floor: [14, 268, 365, 46], props: [[5, 80, 129, 171], [154, 120, 106, 83], [260, 38, 119, 147]] },
  kitchen: { floorY: 202, wall: [108, 25], floor: [16, 208, 68, 68], tiles: [[27, 225], [60, 225]], props: [[174, 260, 194, 114], [15, 303, 60, 71], [107, 208, 129, 52]] },
  bathroom: { floorY: 119, wall: [180, 25], floor: [128, 124, 224, 27], tiles: [[140, 140], [175, 140]], props: [[14, 45, 112, 205], [158, 153, 197, 92], [359, 64, 136, 93], [379, 156, 117, 91]] },
};
const cache = new WeakMap();
export function roomArtBounds(image, type) {
  const x = 16, y = type === 'bedroom' ? 4 : 16;
  return { x, y, width: image.naturalWidth - x * 2, height: image.naturalHeight - y - 16 };
}
const rgb = p => `rgb(${p[0]},${p[1]},${p[2]})`;
const key = (r, g, b) => `${r >> 4},${g >> 4},${b >> 4}`;

function prepare(image, type) {
  if (cache.has(image)) return cache.get(image);
  const spec = rooms[type], source = document.createElement('canvas');
  source.width = image.naturalWidth; source.height = image.naturalHeight;
  const ctx = source.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, source.width, source.height);
  const pixel = (x, y) => pixels.data.slice((y * source.width + x) * 4, (y * source.width + x) * 4 + 3);
  const palette = new Set();
  if (spec.floor) {
    const [x, y, w, h] = spec.floor;
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) palette.add(key(...pixel(px, py)));
  } else spec.tiles.forEach(([x, y]) => palette.add(key(...pixel(x, y))));
  const sprites = spec.props.map(([x, y, w, h]) => {
    const sprite = document.createElement('canvas'); sprite.width = w; sprite.height = h;
    const data = ctx.getImageData(x, y, w, h), seen = new Uint8Array(w * h), queue = [];
    // Only remove floor connected to the outside of a furnishing. Dark outlines
    // enclose and protect similarly colored wooden furniture and its details.
    function visit(px, py) {
      if (px < 0 || py < 0 || px >= w || py >= h || y + py < spec.floorY) return;
      const index = py * w + px, i = index * 4;
      if (seen[index]) return;
      seen[index] = 1;
      const [r, g, b] = data.data.subarray(i, i + 3);
      if ((r + g + b) / 3 < 83 || !palette.has(key(r, g, b))) return;
      data.data[i + 3] = 0; queue.push(index);
    }
    for (let px = 0; px < w; px++) { visit(px, 0); visit(px, h - 1); }
    for (let py = 0; py < h; py++) { visit(0, py); visit(w - 1, py); }
    for (let i = 0; i < queue.length; i++) { const px = queue[i] % w, py = Math.floor(queue[i] / w); visit(px - 1, py); visit(px + 1, py); visit(px, py - 1); visit(px, py + 1); }
    sprite.getContext('2d').putImageData(data, 0, 0);
    return { image: sprite, x, y };
  });
  const prepared = { ...spec, sprites, wallColor: rgb(pixel(...spec.wall)), tileColors: spec.tiles?.map(point => rgb(pixel(...point))) };
  cache.set(image, prepared); return prepared;
}

function plant(ctx, x, y) {
  const rect = (color, a, b, w, h) => { ctx.fillStyle = color; ctx.fillRect(x + a, y + b, w, h); };
  rect('#755239', 7, 30, 34, 5); rect('#79553e', 10, 13, 27, 21);
  rect('#c28e5a', 13, 18, 21, 13); rect('#e1af79', 10, 13, 27, 5);
  rect('#4f643b', 21, -21, 5, 37); rect('#587449', 8, -11, 15, 10);
  rect('#718d50', 11, -17, 8, 12); rect('#718d50', 25, -12, 12, 12);
  rect('#9cab67', 27, -17, 6, 13); rect('#9cab67', 21, -24, 5, 13);
}
function furnishing(ctx, kind, x, y, type) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  const rect = (color, a, b, w, h) => { ctx.fillStyle = color; ctx.fillRect(a, b, w, h); };
  if (kind === 'plant') plant(ctx, -24, 0);
  else if (kind === 'rug') {
    const pink = !['bathroom', 'kitchen'].includes(type);
    rect('#87674e', -54, -23, 108, 49); rect(pink ? '#d797a0' : '#83b4be', -52, -22, 104, 45);
    rect(pink ? '#f1c4c2' : '#b5d6d8', -47, -17, 94, 35);
    for (let i = -45; i <= 45; i += 9) { rect('#f8e5cd', i, -20, 4, 3); rect('#f8e5cd', i, 17, 4, 3); }
  } else {
    // A small bench/table with books, towels, or a plant depending on the room.
    rect('#785039', -41, 17, 82, 7); rect('#785039', -35, 20, 6, 22); rect('#785039', 29, 20, 6, 22);
    rect('#bc8858', -39, -7, 78, 27); rect('#e0ae76', -36, -5, 72, 18);
    rect('#986842', -36, 14, 72, 4);
    if (type === 'bathroom') {
      rect('#7e9f99', -23, -15, 31, 9); rect('#d5e2cf', -25, -20, 34, 6); rect('#fff0db', -23, -24, 31, 5);
      rect('#85674b', 20, -20, 11, 15); rect('#d7a1ac', 22, -25, 7, 17);
    } else {
      rect('#87644a', -27, -14, 31, 7); rect('#9cabb2', -27, -17, 29, 4); rect('#f4e4c7', -24, -22, 28, 4);
      plant(ctx, 8, -42);
    }
  }
  ctx.restore();
}

export function drawRoomScene(ctx, image, type, width, height) {
  const scene = prepare(image, type), bounds = roomArtBounds(image, type);
  const sw = bounds.width;
  const left = (width - sw) / 2, floorY = scene.floorY - bounds.y;
  // A single continuous surface, including the floor under the original props.
  ctx.fillStyle = scene.tileColors?.[0] || (type === 'bedroom' ? '#ca945f' : '#c18d5e');
  ctx.fillRect(0, 0, width, height);
  if (scene.tileColors) {
    const size = 34;
    for (let y = floorY, row = 0; y < height; y += size, row++) for (let x = 0, col = 0; x < width; x += size, col++) {
      ctx.fillStyle = scene.tileColors[(row + col) % 2]; ctx.fillRect(x, y, size, size);
      if (type === 'bathroom') { ctx.fillStyle = '#9c9b9380'; ctx.fillRect(x, y, size, 2); ctx.fillRect(x, y, 2, size); }
    }
  } else {
    ctx.fillStyle = type === 'bedroom' ? '#ca945f' : '#c18d5e'; ctx.fillRect(0, floorY, width, height - floorY);
    for (let y = floorY, row = 0; y < height; y += 21, row++) {
      ctx.fillStyle = '#a87549'; ctx.fillRect(0, y, width, 2);
      ctx.fillStyle = '#dfaf7c'; ctx.fillRect(0, y + 2, width, 2);
      for (let x = (row % 2 ? -44 : 0); x < width; x += 88) { ctx.fillStyle = '#a87549'; ctx.fillRect(x, y, 2, 21); }
    }
  }
  ctx.fillStyle = scene.wallColor; ctx.fillRect(0, 0, width, floorY);
  // Keep the complete wall illustration, omitting its old bottom floor strip.
  ctx.drawImage(image, bounds.x, bounds.y, sw, floorY, left, 0, sw, floorY);
  ctx.fillStyle = '#795438'; ctx.fillRect(0, floorY - 5, width, 5);
  ctx.fillStyle = '#bd8c5d'; ctx.fillRect(0, floorY - 5, width, 2);
  ctx.save(); ctx.beginPath(); ctx.rect(left, 0, sw, bounds.height); ctx.clip();
  for (const sprite of scene.sprites) ctx.drawImage(sprite.image, left + sprite.x - bounds.x, sprite.y - bounds.y);
  ctx.restore();

  // Furnish only newly available space, with enough clearance for each prop.
  let additions = 0;
  const occupiedBottom = Math.max(...scene.props.map(([, y, , h]) => y + h)) - bounds.y;
  const freeHeight = height - occupiedBottom;
  if (freeHeight > 90) {
    const y = occupiedBottom + freeHeight / 2;
    furnishing(ctx, 'rug', width / 2, y, type); additions++;
    if (width > 260) { furnishing(ctx, 'table', width - 64, y - 8, type); furnishing(ctx, 'plant', 44, y, type); additions += 2; }
  } else if (freeHeight > 48 && width > 180) {
    furnishing(ctx, 'rug', width / 2, height - 28, type);
    furnishing(ctx, 'plant', width - 43, height - 37, type); additions += 2;
  }
  if (left > 62) {
    for (const x of [left / 2, width - left / 2]) {
      const y = floorY + (height - floorY) * .62;
      furnishing(ctx, 'plant', x, floorY + 33, type); additions++;
      if (height - floorY > 140 && left > 92) { furnishing(ctx, 'table', x, y, type); additions++; }
    }
  }
  return additions;
}

export function drawHallwayScene(ctx, width, height) {
  ctx.fillStyle = '#d9d1bd'; ctx.fillRect(0, 0, width, height);
  const size = 32;
  for (let y = 0, row = 0; y < height; y += size, row++) {
    for (let x = 0, col = 0; x < width; x += size, col++) {
      ctx.fillStyle = (row + col) % 2 ? '#ddd6c5' : '#e7dfcd';
      ctx.fillRect(x + 2, y + 2, size - 2, size - 2);
      ctx.fillStyle = '#f0e9d9'; ctx.fillRect(x + 2, y + 2, size - 2, 1);
    }
  }
}

export function drawLaundryScene(ctx, width, height) {
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
  const center = Math.round(width / 2), wall = 112;
  rect('#c9cdbb', 0, 0, width, height);
  for (let y = wall, row = 0; y < height; y += 28, row++) for (let x = 0, col = 0; x < width; x += 28, col++) {
    rect((row + col) % 2 ? '#d6d9c8' : '#e8e5d4', x + 2, y + 2, 26, 26);
  }
  rect('#c2d0ba', 0, 0, width, wall); rect('#816347', 0, wall - 5, width, 5); rect('#caa77a', 0, wall - 5, width, 2);
  // Shelving, folded towels, and detergent bottles above the appliances.
  rect('#795c43', center - 91, 57, 182, 7); rect('#d5ae7c', center - 94, 53, 188, 5);
  rect('#7d9d95', center - 78, 43, 43, 10); rect('#a9c0aa', center - 81, 35, 46, 9);
  rect('#f5e8d0', center - 77, 28, 40, 8); rect('#e1b0af', center - 73, 23, 35, 6);
  for (const [x, color] of [[center - 8, '#92bac3'], [center + 21, '#d3a1b0'], [center + 50, '#dfcb8d']]) {
    rect('#795c43', x, 30, 20, 23); rect(color, x + 2, 32, 16, 19);
    rect('#795c43', x + 5, 24, 10, 7); rect('#f2e8d2', x + 5, 39, 10, 7);
  }
  // Front-loading washer and dryer with stepped pixel circles.
  for (const [x, glass] of [[center - 82, '#8fb6bb'], [center + 5, '#a7bdba']]) {
    rect('#80654e', x, 81, 77, 85); rect('#f4edda', x + 3, 84, 71, 78);
    rect('#d6d9ca', x + 3, 85, 71, 15); rect('#a8b6aa', x + 10, 88, 24, 7);
    rect('#7d8070', x + 55, 88, 9, 8); rect('#f7f2df', x + 57, 89, 4, 4);
    const drum = (color, a, b, size) => {
      rect(color, a + 8, b, size - 16, size); rect(color, a + 3, b + 5, size - 6, size - 10); rect(color, a, b + 12, size, size - 24);
    };
    drum('#889b93', x + 13, 106, 51); drum('#596d6c', x + 17, 110, 43); drum(glass, x + 21, 114, 35);
    rect('#d3e5db', x + 25, 118, 12, 5); rect('#edf3dc', x + 25, 123, 5, 8);
    rect('#657d7a', x + 39, 137, 11, 5); rect('#b4c6b6', x + 24, 143, 18, 4);
    rect('#816347', x + 6, 164, 8, 5); rect('#816347', x + 63, 164, 8, 5);
  }
  rect('#866448', center - 88, 76, 177, 7); rect('#dec297', center - 90, 72, 181, 5);
  // Floor hamper and drying rack stay clear of the washer doors.
  const bottom = Math.max(211, Math.min(height - 13, 300));
  rect('#866b4e', 22, bottom - 45, 43, 39); rect('#c8b187', 25, bottom - 42, 37, 33);
  for (let x = 30; x < 61; x += 8) rect('#aa8e68', x, bottom - 37, 2, 24);
  rect('#a6bbc0', 24, bottom - 50, 30, 11); rect('#e5b7bb', 35, bottom - 55, 25, 12);
  const rackX = width - 76;
  rect('#957957', rackX, bottom - 47, 58, 4); rect('#957957', rackX + 4, bottom - 47, 4, 42); rect('#957957', rackX + 49, bottom - 47, 4, 42);
  rect('#f3e5ce', rackX + 12, bottom - 46, 22, 32); rect('#d4a4a8', rackX + 14, bottom - 21, 18, 4);
  rect('#92aaa0', rackX + 38, bottom - 46, 12, 22);
}

export function drawCustomScene(ctx, width, height) {
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
  const wall = 96, center = Math.round(width / 2);
  rect('#d0aa79', 0, 0, width, height);
  for (let y = wall, row = 0; y < height; y += 24, row++) {
    rect('#ae855d', 0, y, width, 2); rect('#e6c595', 0, y + 2, width, 2);
    for (let x = row % 2 ? -45 : 0; x < width; x += 90) rect('#ae855d', x, y, 2, 24);
  }
  // A sage studio with a work desk and storage, distinct from the lounge.
  rect('#b9c7ac', 0, 0, width, wall); rect('#826345', 0, wall - 5, width, 5);
  rect('#d7b98b', 0, wall - 5, width, 2);
  const windowX = center - 38;
  rect('#795d42', windowX - 4, 13, 84, 65); rect('#f6e8c8', windowX, 17, 76, 57);
  rect('#9bced4', windowX + 4, 21, 68, 49); rect('#e7f3e9', windowX + 8, 25, 25, 5);
  rect('#e7f3e9', windowX + 12, 30, 16, 4); rect('#ad8b5f', center - 2, 18, 4, 56);
  rect('#ad8b5f', windowX + 1, 43, 74, 4); rect('#826345', windowX - 7, 76, 90, 5);
  // Shelf with upright books and a little framed print.
  rect('#8b6949', 18, 66, 50, 6);
  for (const [x, color, h] of [[22, '#d39ca3', 27], [32, '#e8d8ab', 22], [42, '#83a39a', 30], [52, '#9c9eb2', 25]]) {
    rect('#795d42', x, 66 - h, 9, h); rect(color, x + 2, 68 - h, 5, h - 4);
  }
  rect('#826345', width - 59, 25, 37, 44); rect('#fff0d6', width - 55, 29, 29, 36);
  rect('#d5a180', width - 50, 48, 19, 12); rect('#98ad8e', width - 45, 36, 8, 18);
  // Broad worktable, drawers, notebook, pen cup, and a chair.
  rect('#79583f', center - 66, 113, 132, 10); rect('#e1b884', center - 63, 107, 126, 11);
  rect('#8d694c', center - 59, 123, 6, 42); rect('#8d694c', center + 35, 123, 26, 40);
  rect('#c79e6e', center + 38, 126, 20, 15); rect('#c79e6e', center + 38, 144, 20, 15);
  rect('#f4dfb8', center + 44, 130, 7, 3); rect('#f4dfb8', center + 44, 148, 7, 3);
  rect('#858f91', center - 38, 100, 34, 7); rect('#f9eacb', center - 36, 97, 30, 5);
  rect('#d69f9d', center + 16, 93, 13, 14); rect('#79583f', center + 18, 83, 3, 13); rect('#9aa678', center + 24, 85, 3, 12);
  rect('#79583f', center - 18, 142, 36, 27); rect('#839e8f', center - 15, 145, 30, 18);
  rect('#79583f', center - 14, 169, 5, 19); rect('#79583f', center + 9, 169, 5, 19);
  const rugY = Math.max(204, Math.min(height - 38, height * .73));
  rect('#788c79', center - 61, rugY - 22, 122, 46); rect('#a7bd9f', center - 58, rugY - 19, 116, 40);
  rect('#dce0ba', center - 51, rugY - 12, 102, 26);
  furnishing(ctx, 'plant', width - 37, Math.min(height - 39, 196), 'custom');
  // Woven storage basket, with a folded blanket.
  rect('#8d694c', 21, height - 67, 44, 33); rect('#c2a06d', 24, height - 64, 38, 27);
  rect('#efd0b3', 21, height - 72, 30, 12); rect('#c59b9c', 24, height - 76, 25, 7);
  for (let x = 28; x < 60; x += 8) rect('#a78354', x, height - 61, 2, 21);
}
