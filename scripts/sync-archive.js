#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRNkKWFXlDXnKZqWVcH-TWXJkhM_pLGlwYup4wvIUzD6K0YvI7LVhoJL1EdorkPPLmFrtgdAcyeaI0V/pub?gid=0&single=true&output=csv';

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'archive.json');

const OUTPUT_FIELDS = [
  'rock',
  'notebook',
  'sequence',
  'id',
  'dateCaptured',
  'title',
  'notes',
  'locationLabel',
  'locationName',
  'country',
  'city',
  'lat',
  'lng',
  'inkColor',
  'surfaceType',
  'scanImage',
  'tags',
  'collaborator',
];

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const { statusCode, headers } = response;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          resolve(fetchCsv(headers.location));
          return;
        }

        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`Request failed with status ${statusCode}`));
          return;
        }

        response.setEncoding('utf8');

        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => resolve(data));
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function toTrimmedString(value) {
  return String(value || '').trim();
}

function toNumberOrNull(value) {
  const trimmed = toTrimmedString(value);

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTags(value) {
  const trimmed = toTrimmedString(value);

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toScanImage(id, value) {
  return `/scans/${id}.jpg`;
}

function isMeaningfulRow(row) {
  return row.some((value) => toTrimmedString(value) !== '');
}

function mapRow(headers, row) {
  const source = {};

  headers.forEach((header, index) => {
    source[header] = row[index] || '';
  });

  const id = toTrimmedString(source.id);

  if (!id) {
    return null;
  }

  const hasContentBeyondId = Object.keys(source).some((key) => {
    if (key === 'id') {
      return false;
    }

    return toTrimmedString(source[key]) !== '';
  });

  if (!hasContentBeyondId) {
    return null;
  }

  return {
    rock: toTrimmedString(source.rock),
    notebook: toTrimmedString(source.notebook),
    sequence: toTrimmedString(source.sequence),
    id,
    dateCaptured: toTrimmedString(source.dateCaptured),
    title: toTrimmedString(source.title),
    notes: toTrimmedString(source.notes),
    locationLabel: toTrimmedString(source.locationLabel),
    locationName: toTrimmedString(source.locationName),
    country: toTrimmedString(source.country),
    city: toTrimmedString(source.city),
    lat: toNumberOrNull(source.lat),
    lng: toNumberOrNull(source.lng),
    inkColor: toTrimmedString(source.inkColor),
    surfaceType: toTrimmedString(source.surfaceType),
    scanImage: toScanImage(id, source.scanImage),
    tags: toTags(source.tags),
    collaborator: toTrimmedString(source.collaborator),
  };
}

async function main() {
  try {
    const csvText = await fetchCsv(CSV_URL);
    const rows = parseCsv(csvText).filter(isMeaningfulRow);

    if (rows.length === 0) {
      throw new Error('No rows found in CSV.');
    }

    const [headerRow, ...dataRows] = rows;
    const headers = headerRow.map((header) => toTrimmedString(header));

    const archive = dataRows
      .map((row) => mapRow(headers, row))
      .filter(Boolean)
      .map((entry) => {
        const orderedEntry = {};

        OUTPUT_FIELDS.forEach((field) => {
          orderedEntry[field] = entry[field];
        });

        return orderedEntry;
      });

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');

    console.log(`Synced ${archive.length} archive records to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error(`Failed to sync archive data: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
