const archiveGrid = document.getElementById('archive-grid');
const archiveSentinel = document.getElementById('archive-sentinel');
const recordCount = document.getElementById('record-count');
const detailTemplate = document.getElementById('detail-template');

const basePath = window.location.pathname.includes('/urban-texture/')
  ? '/urban-texture'
  : '';

const PAGE_SIZE = 9;

let archiveEntries = [];
let renderedCount = 0;
let activeCard = null;
let observer = null;

const imagePathCandidates = (entry) => [
  `${basePath}/public/scans/batch%201/jpg/${encodeURIComponent(entry.id)}.jpg`,
  `${basePath}/public/scans/${encodeURIComponent(entry.id)}.jpg`,
  entry.scanImage ? `${basePath}${entry.scanImage}` : '',
].filter(Boolean);

function toSubtitle(entry) {
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
  const image = fragment.querySelector('.detail-image');
  const title = fragment.querySelector('.detail-title');
  const id = fragment.querySelector('.detail-id');
  const notes = fragment.querySelector('.detail-notes');
  const metadata = fragment.querySelector('.detail-metadata');

  title.textContent = entry.title || 'Untitled';
  id.textContent = entry.id;
  notes.textContent = entry.notes || 'no additional notes.';
  image.alt = entry.title || entry.id;

  hydrateImage(image, imagePathCandidates(entry));

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

function renderEntry(entry, index) {
  const button = document.createElement('button');
  const imageWrap = document.createElement('div');
  const image = document.createElement('img');
  const copy = document.createElement('div');
  const meta = document.createElement('p');
  const title = document.createElement('h2');
  const subtitle = document.createElement('div');

  button.className = 'entry-card';
  button.type = 'button';
  button.setAttribute('aria-label', `${entry.title || 'Untitled'}, ${entry.id}`);
  button.setAttribute('aria-expanded', 'false');

  imageWrap.className = 'entry-image-wrap';
  image.className = 'entry-image';
  image.loading = index < 6 ? 'eager' : 'lazy';
  image.alt = entry.title || entry.id;
  hydrateImage(image, imagePathCandidates(entry));

  copy.className = 'entry-copy';
  meta.className = 'entry-meta';
  title.className = 'entry-title';
  subtitle.className = 'entry-subtitle';

  meta.textContent = entry.id;
  title.textContent = entry.title || 'Untitled';

  const subtitleLines = toSubtitle(entry);

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

function renderNextBatch() {
  const nextEntries = archiveEntries.slice(renderedCount, renderedCount + PAGE_SIZE);

  nextEntries.forEach((entry, index) => {
    archiveGrid.append(renderEntry(entry, renderedCount + index));
  });

  renderedCount += nextEntries.length;

  if (renderedCount >= archiveEntries.length && observer) {
    observer.disconnect();
    archiveSentinel.hidden = true;
  }
}

function setupInfiniteScroll() {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        renderNextBatch();
      }
    },
    {
      rootMargin: '1200px 0px',
    }
  );

  observer.observe(archiveSentinel);
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
      archiveSentinel.hidden = true;
      return;
    }

    archiveGrid.innerHTML = '';
    renderedCount = 0;
    activeCard = null;
    recordCount.textContent = `Nº ${archiveEntries.length} / [   ]`;

    renderNextBatch();
    setupInfiniteScroll();
  } catch (error) {
    archiveGrid.innerHTML = `<p class="status-message">${error.message}</p>`;
    recordCount.textContent = 'Archive unavailable';
    archiveSentinel.hidden = true;
  }
}

loadArchive();
