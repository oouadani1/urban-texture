#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BATCH_DIR = path.join(__dirname, '..', 'public', 'scans', 'batch 1');
const INPUT_DIR = path.join(BATCH_DIR, 'pdf');
const OUTPUT_DIR = path.join(BATCH_DIR, 'jpg');
const TEMP_DIR = path.join(BATCH_DIR, '.tmp-render');

function getPdfFiles(directoryPath) {
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdf')
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();
}

function runCommand(command, args, errorLabel) {
  const result = spawnSync(command, args, { encoding: 'utf8' });

  if (result.status !== 0 || result.error) {
    const message = (result.stderr || result.stdout || 'Unknown conversion error').trim();
    throw new Error(`${errorLabel}: ${message}`);
  }
}

function renderPdfPreview(pdfPath) {
  runCommand(
    'qlmanage',
    ['-t', '-s', '4096', '-o', TEMP_DIR, pdfPath],
    path.relative(INPUT_DIR, pdfPath)
  );

  const renderedFileName = `${path.basename(pdfPath)}.png`;
  const renderedPath = path.join(TEMP_DIR, renderedFileName);

  if (!fs.existsSync(renderedPath)) {
    throw new Error(`${path.relative(INPUT_DIR, pdfPath)}: Quick Look did not produce ${renderedFileName}`);
  }

  return renderedPath;
}

function convertPngToJpg(pngPath, jpgPath, label) {
  runCommand(
    'sips',
    ['-s', 'format', 'jpeg', '-s', 'formatOptions', 'best', pngPath, '--out', jpgPath],
    label
  );
}

function convertPdfToJpg(pdfPath) {
  const baseName = path.basename(pdfPath, path.extname(pdfPath));
  const jpgPath = path.join(OUTPUT_DIR, `${baseName}.jpg`);
  const renderedPath = renderPdfPreview(pdfPath);

  convertPngToJpg(renderedPath, jpgPath, path.relative(INPUT_DIR, pdfPath));
  fs.unlinkSync(renderedPath);

  return path.basename(jpgPath);
}

function main() {
  try {
    if (!fs.existsSync(INPUT_DIR)) {
      throw new Error(`PDF input directory not found: ${INPUT_DIR}`);
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const pdfFiles = getPdfFiles(INPUT_DIR);

    if (pdfFiles.length === 0) {
      console.log(`No PDF scans found in ${INPUT_DIR}`);
      return;
    }

    const converted = pdfFiles.map(convertPdfToJpg);

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log(`Converted ${converted.length} PDF scans to JPG in ${OUTPUT_DIR}`);
  } catch (error) {
    console.error(`Failed to convert scans: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
