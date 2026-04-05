const archiveGrid = document.getElementById('archive-grid');
const recordCount = document.getElementById('record-count');
const detailEmpty = document.getElementById('detail-empty');
const detailContent = document.getElementById('detail-content');
const detailTemplate = document.getElementById('detail-template');

const basePath = window.location.pathname.includes('/urban-texture/')
  ? '/urban-texture'
  : '';

const imagePathCandidates = (entry) => [
  `${basePath}/public/scans/batch%201/jpg/${encodeURIComponent(entry.id)}.jpg`,
  `${basePath}/public/scans/${encodeURIComponent(entry.id)}.jpg`,
  entry.scanImage ? `${basePath}${entry.scanImage}` : '',
].filter(Boolean);

function toSubtitle(entry) {
  const parts = [entry.locationName, entry.city, entry.country].filter(Boolean);
  return parts.join(' · ');
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

function renderDetail(entry) {
  detailEmpty.hidden = true;
  detailContent.hidden = false;
  detailContent.innerHTML = '';

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

  detailContent.append(fragment);
}

function renderEntry(entry, index) {
  const button = document.createElement('button');
  const imageWrap = document.createElement('div');
  const image = document.createElement('img');
  const copy = document.createElement('div');
  const meta = document.createElement('p');
  const title = document.createElement('h2');
  const subtitle = document.createElement('p');

  button.className = 'entry-card';
  button.type = 'button';
  button.setAttribute('aria-label', `${entry.title || 'Untitled'}, ${entry.id}`);

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
  subtitle.textContent = toSubtitle(entry) || 'Archive entry';

  copy.append(meta, title, subtitle);
  imageWrap.append(image);
  button.append(imageWrap, copy);

  button.addEventListener('click', () => {
    document.querySelectorAll('.entry-card.is-selected').forEach((card) => {
      card.classList.remove('is-selected');
    });

    button.classList.add('is-selected');
    renderDetail(entry);
  });

  return button;
}

async function loadArchive() {
  try {
    const response = await fetch(`${basePath}/src/data/archive.json`);

    if (!response.ok) {
      throw new Error(`Archive request failed with status ${response.status}`);
    }

    const archive = await response.json();

    if (!Array.isArray(archive) || archive.length === 0) {
      archiveGrid.innerHTML = '<p class="status-message">No archive entries found.</p>';
      recordCount.textContent = '0 entries';
      return;
    }

    archiveGrid.innerHTML = '';
    archive.forEach((entry, index) => {
      archiveGrid.append(renderEntry(entry, index));
    });

    recordCount.textContent = `${archive.length} / 999,999`;
    archiveGrid.firstElementChild?.click();
  } catch (error) {
    archiveGrid.innerHTML = `<p class="status-message">${error.message}</p>`;
    recordCount.textContent = 'Archive unavailable';
  }
}

loadArchive();
