const archiveGrid = document.getElementById('archive-grid');
const archiveViewport = document.getElementById('archive-viewport');
const recordCount = document.getElementById('record-count');
const shuffleButton = document.getElementById('shuffle-button');
const detailTemplate = document.getElementById('detail-template');

const basePath = window.location.pathname.includes('/urban-texture/')
  ? '/urban-texture'
  : '';

const PLANE_WIDTH = 5600;
const PLANE_HEIGHT = 4200;
const CARD_WIDTHS = [290, 320, 350];
const SLOT_X = 370;
const SLOT_Y = 620;
const CARD_JITTER_X = 56;
const CARD_JITTER_Y = 84;

let archiveEntries = [];
let activeCard = null;
let shuffleCount = 0;

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

function createLayoutSlots(count) {
  const centerX = Math.floor(PLANE_WIDTH / 2);
  const centerY = Math.floor(PLANE_HEIGHT / 2);
  const positions = [];
  let ring = 0;

  while (positions.length < count) {
    if (ring === 0) {
      positions.push({ x: centerX, y: centerY });
      ring += 1;
      continue;
    }

    for (let row = -ring; row <= ring && positions.length < count; row += 1) {
      for (let col = -ring; col <= ring && positions.length < count; col += 1) {
        const onEdge = Math.abs(row) === ring || Math.abs(col) === ring;

        if (!onEdge) {
          continue;
        }

        positions.push({
          x: centerX + col * SLOT_X,
          y: centerY + row * SLOT_Y,
        });
      }
    }

    ring += 1;
  }

  return shuffleArray(positions);
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

function buildExpandedDetail(entry) {
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

function collapseCard(card) {
  if (!card) {
    return;
  }

  const expanded = card.querySelector('.entry-expanded-shell');
  if (expanded) {
    expanded.remove();
  }

  card.classList.remove('is-selected');
  card.setAttribute('aria-expanded', 'false');
}

function expandCard(card, entry) {
  if (activeCard === card) {
    collapseCard(card);
    activeCard = null;
    return;
  }

  collapseCard(activeCard);

  const expandedShell = document.createElement('div');
  expandedShell.className = 'entry-expanded-shell';
  expandedShell.append(buildExpandedDetail(entry));

  card.append(expandedShell);
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

  const width = CARD_WIDTHS[(index + shuffleCount) % CARD_WIDTHS.length];
  const offsetX = ((index * 37 + shuffleCount * 53) % (CARD_JITTER_X * 2 + 1)) - CARD_JITTER_X;
  const offsetY = ((index * 61 + shuffleCount * 41) % (CARD_JITTER_Y * 2 + 1)) - CARD_JITTER_Y;

  button.className = 'entry-card';
  button.type = 'button';
  button.setAttribute('aria-label', `${entry.title || 'Untitled'}, ${entry.id}`);
  button.setAttribute('aria-expanded', 'false');
  button.style.width = `${width}px`;
  button.style.left = `${Math.max(72, position.x + offsetX - width / 2)}px`;
  button.style.top = `${Math.max(72, position.y + offsetY - 180)}px`;

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

  copy.append(meta, title, subtitle);
  imageWrap.append(image);
  button.append(imageWrap, copy);

  button.addEventListener('click', () => {
    expandCard(button, entry);
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

loadArchive();
