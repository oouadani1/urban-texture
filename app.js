const archiveGrid = document.getElementById('archive-grid');
const archiveViewport = document.getElementById('archive-viewport');
const recordCount = document.getElementById('record-count');
const shuffleButton = document.getElementById('shuffle-button');
const detailTemplate = document.getElementById('detail-template');

const basePath = window.location.pathname.includes('/urban-texture/')
  ? '/urban-texture'
  : '';

const PLANE_WIDTH = 5200;
const PLANE_HEIGHT = 3800;
const SLOT_WIDTH = 420;
const SLOT_HEIGHT = 560;
const COLLAPSED_WIDTHS = [280, 308, 332];
const EXPANDED_WIDTH = 420;
const SLOT_PADDING = 36;

let archiveEntries = [];
let activeCard = null;
let shuffleCount = 0;
let isPointerPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;

const imagePathCandidates = (entry) => [
  `${basePath}/public/scans/batch%201/jpg/${encodeURIComponent(entry.id)}.jpg`,
  `${basePath}/public/scans/${encodeURIComponent(entry.id)}.jpg`,
  entry.scanImage ? `${basePath}${entry.scanImage}` : '',
].filter(Boolean);

function shuffleArray(values) {
  const copy = [...values];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function toSubtitleLines(entry) {
  const lines = [];

  if (entry.notes) {
    lines.push(entry.notes);
  }

  const locationLine = [entry.city, entry.country].filter(Boolean).join(', ');

  if (locationLine) {
    lines.push(locationLine);
  }

  return lines;
}

function toMetadata(entry) {
  const items = [
    ['Date', entry.dateCaptured],
    ['Surface', entry.surfaceType],
    ['Ink', entry.inkColor],
    ['Location', entry.locationLabel || entry.locationName],
    ['Collaborator', entry.collaborator],
    ['Tags', entry.tags.join(', ')],
  ];

  return items.filter(([, value]) => value);
}

function hydrateImage(image, candidates) {
  let index = 0;

  function tryNext() {
    if (index >= candidates.length) {
      image.removeAttribute('src');
      image.alt = 'Scan unavailable';
      return;
    }

    image.src = candidates[index];
    index += 1;
  }

  image.addEventListener('error', tryNext);
  tryNext();
}

function buildDetailContent(entry) {
  const fragment = detailTemplate.content.cloneNode(true);
  const title = fragment.querySelector('.detail-title');
  const id = fragment.querySelector('.detail-id');
  const notes = fragment.querySelector('.detail-notes');
  const metadata = fragment.querySelector('.detail-metadata');

  title.textContent = entry.title || 'Untitled';
  id.textContent = entry.id;
  notes.textContent = entry.notes || 'no additional notes.';

  toMetadata(entry).forEach(([label, value]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');

    dt.textContent = label;
    dd.textContent = value;
    metadata.append(dt, dd);
  });

  return fragment;
}

function createLayoutSlots(count) {
  const cols = Math.max(1, Math.floor((PLANE_WIDTH - SLOT_PADDING * 2) / SLOT_WIDTH));
  const rows = Math.max(1, Math.ceil(count / cols));
  const total = cols * rows;
  const slots = [];

  for (let index = 0; index < total; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const offsetX = ((row + shuffleCount) % 2) * 42;

    slots.push({
      x: SLOT_PADDING + col * SLOT_WIDTH + offsetX,
      y: SLOT_PADDING + row * SLOT_HEIGHT + ((col + shuffleCount) % 3) * 18,
    });
  }

  return shuffleArray(slots).slice(0, count);
}

function collapseCard(card) {
  if (!card) {
    return;
  }

  card.classList.remove('is-selected');
  card.setAttribute('aria-expanded', 'false');
}

function expandCard(card) {
  if (activeCard === card) {
    collapseCard(card);
    activeCard = null;
    return;
  }

  collapseCard(activeCard);
  card.classList.add('is-selected');
  card.setAttribute('aria-expanded', 'true');
  activeCard = card;
}

function renderEntry(entry, index, position) {
  const button = document.createElement('button');
  const imageWrap = document.createElement('div');
  const image = document.createElement('img');
  const copy = document.createElement('div');
  const meta = document.createElement('p');
  const title = document.createElement('h2');
  const subtitle = document.createElement('div');
  const detailShell = document.createElement('div');

  const collapsedWidth = COLLAPSED_WIDTHS[(index + shuffleCount) % COLLAPSED_WIDTHS.length];

  button.className = 'entry-card';
  button.type = 'button';
  button.setAttribute('aria-label', `${entry.title || 'Untitled'}, ${entry.id}`);
  button.setAttribute('aria-expanded', 'false');
  button.style.width = `${collapsedWidth}px`;
  button.style.left = `${position.x}px`;
  button.style.top = `${position.y}px`;

  imageWrap.className = 'entry-image-wrap';
  image.className = 'entry-image';
  image.loading = index < 8 ? 'eager' : 'lazy';
  image.alt = entry.title || entry.id;
  hydrateImage(image, imagePathCandidates(entry));

  copy.className = 'entry-copy';
  meta.className = 'entry-meta';
  title.className = 'entry-title';
  subtitle.className = 'entry-subtitle';

  meta.textContent = entry.id;
  title.textContent = entry.title || 'Untitled';

  const subtitleLines = toSubtitleLines(entry);

  if (subtitleLines.length === 0) {
    subtitle.textContent = 'Archive entry';
  } else {
    subtitleLines.forEach((line) => {
      const lineElement = document.createElement('span');
      lineElement.className = 'entry-subtitle-line';
      lineElement.textContent = line;
      subtitle.append(lineElement);
    });
  }

  detailShell.className = 'entry-detail-shell';
  detailShell.append(buildDetailContent(entry));

  copy.append(meta, title, subtitle);
  imageWrap.append(image);
  button.append(imageWrap, copy, detailShell);

  button.addEventListener('click', () => {
    expandCard(button);
  });

  return button;
}

function centerViewport() {
  const left = Math.max(0, PLANE_WIDTH / 2 - archiveViewport.clientWidth / 2);
  const top = Math.max(0, PLANE_HEIGHT / 2 - archiveViewport.clientHeight / 2);
  archiveViewport.scrollTo({ left, top, behavior: 'auto' });
}

function renderArchive() {
  archiveGrid.innerHTML = '';
  activeCard = null;
  archiveGrid.style.width = `${PLANE_WIDTH}px`;
  archiveGrid.style.height = `${PLANE_HEIGHT}px`;

  const shuffledEntries = shuffleArray(archiveEntries);
  const positions = createLayoutSlots(shuffledEntries.length);

  shuffledEntries.forEach((entry, index) => {
    archiveGrid.append(renderEntry(entry, index, positions[index]));
  });

  centerViewport();
}

function onPointerMove(event) {
  if (!isPointerPanning) {
    return;
  }

  const deltaX = event.clientX - panStartX;
  const deltaY = event.clientY - panStartY;

  archiveViewport.scrollLeft = panScrollLeft - deltaX;
  archiveViewport.scrollTop = panScrollTop - deltaY;
}

function stopPointerPan() {
  isPointerPanning = false;
  archiveViewport.classList.remove('is-dragging');
}

function setupPanControls() {
  archiveViewport.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.entry-card')) {
      return;
    }

    isPointerPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panScrollLeft = archiveViewport.scrollLeft;
    panScrollTop = archiveViewport.scrollTop;
    archiveViewport.classList.add('is-dragging');
  });

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopPointerPan);
  window.addEventListener('pointercancel', stopPointerPan);
}

async function loadArchive() {
  try {
    const response = await fetch(`${basePath}/src/data/archive.json`);

    if (!response.ok) {
      throw new Error(`Archive request failed with status ${response.status}`);
    }

    archiveEntries = await response.json();

    if (!Array.isArray(archiveEntries) || archiveEntries.length === 0) {
      archiveGrid.innerHTML = '<p class="status-message">No archive entries found.</p>';
      recordCount.textContent = 'Nº 0 / [   ]';
      return;
    }

    recordCount.textContent = `Nº ${archiveEntries.length} / [   ]`;
    renderArchive();
  } catch (error) {
    archiveGrid.innerHTML = `<p class="status-message">${error.message}</p>`;
    recordCount.textContent = 'Archive unavailable';
  }
}

shuffleButton.addEventListener('click', () => {
  shuffleCount += 1;
  renderArchive();
});

window.addEventListener('resize', () => {
  if (archiveEntries.length > 0) {
    centerViewport();
  }
});

setupPanControls();
loadArchive();
