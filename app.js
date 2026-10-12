/**
 * ShrinkByte — Lossless File Compression & Decompression (Huffman Coding)
 * DSCPP-III-2026-T220 Project
 * Team Lead: Deepanshi Agarwal
 * Team Members: Grover Avika, Bhardwaj Darsh, Saini Aayushe
 *
 * Frontend UI/UX, File Management, Smart Extension Detection,
 * Dual Progress Bars, and Zero-Retention Local Download.
 * Compression itself runs in sb01.js (a port of the C++ HuffmanEncoder),
 * inside a Web Worker so large files do not freeze the page.
 */

// Global State
const appState = {
  currentFile: null,
  activeMode: 'compress', // 'compress' | 'decompress'
  processedBlob: null,
  outputFileName: '',
  stats: {
    originalSize: 0,
    processedSize: 0,
    executionTimeMs: 0,
    verified: false
  },
  isProcessing: false
};

// Max file size accepted for ingestion (matches the "Max size 1 GB" label in the drop zone)
const MAX_FILE_SIZE_BYTES = SB01.MAX_INPUT_BYTES;

// Both extensions hold the same SB01 format: .shrink from this UI, .sb from the C++ CLI
const ARCHIVE_EXTENSIONS = ['.shrink', '.sb'];

function isArchiveFile(file) {
  if (!file || !file.name) return false;
  const name = file.name.toLowerCase();
  return ARCHIVE_EXTENSIONS.some(ext => name.endsWith(ext));
}

// The job currently running, so it can be cancelled: { cancelled, cancel() }
let activeRun = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const btnBrowse = document.getElementById('btnBrowse');
const fileDetailsCard = document.getElementById('fileDetailsCard');
const fileTypeIcon = document.getElementById('fileTypeIcon');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileMime = document.getElementById('fileMime');
const detectionBadge = document.getElementById('detectionBadge');
const btnRemoveFile = document.getElementById('btnRemoveFile');

// Byte-Frequency Histogram
const byteHistogramCard = document.getElementById('byteHistogramCard');
const byteHistogramSub = document.getElementById('byteHistogramSub');
const byteHistogramBars = document.getElementById('byteHistogramBars');
const btnToggleHistogram = document.getElementById('btnToggleHistogram');

// Mode Switcher Bar
const modeSwitcherBar = document.getElementById('modeSwitcherBar');
const modeStatusText = document.getElementById('modeStatusText');
const btnToggleCompress = document.getElementById('btnToggleCompress');
const btnToggleDecompress = document.getElementById('btnToggleDecompress');

// Execute CTA
const ctaContainer = document.getElementById('ctaContainer');
const btnExecuteAction = document.getElementById('btnExecuteAction');
const btnActionLabel = document.getElementById('btnActionLabel');
const btnActionIcon = document.getElementById('btnActionIcon');

// Progress Elements
const progressSection = document.getElementById('progressSection');
const uploadProgressBlock = document.getElementById('uploadProgressBlock');
const uploadTitle = document.getElementById('uploadTitle');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadPercentText = document.getElementById('uploadPercentText');
const uploadStatusDesc = document.getElementById('uploadStatusDesc');
const uploadBytesMetric = document.getElementById('uploadBytesMetric');
const uploadSpeedMetric = document.getElementById('uploadSpeedMetric');
const uploadStateBadge = document.getElementById('uploadStateBadge');

const processProgressBlock = document.getElementById('processProgressBlock');
const processStepNum = document.getElementById('processStepNum');
const processMainTitle = document.getElementById('processMainTitle');
const processSubTitle = document.getElementById('processSubTitle');
const processProgressBar = document.getElementById('processProgressBar');
const processPercentText = document.getElementById('processPercentText');

const mileStep1 = document.getElementById('mileStep1');
const mileStep2 = document.getElementById('mileStep2');
const mileStep3 = document.getElementById('mileStep3');
const mileStep4 = document.getElementById('mileStep4');
const mileStep1Label = document.getElementById('mileStep1Label');
const mileStep2Label = document.getElementById('mileStep2Label');
const mileStep3Label = document.getElementById('mileStep3Label');
const mileStep4Label = document.getElementById('mileStep4Label');

const terminalConsole = document.getElementById('terminalConsole');
const btnToggleTerminal = document.getElementById('btnToggleTerminal');

// Results & Download Elements
const resultsSection = document.getElementById('resultsSection');
const resultsTitle = document.getElementById('resultsTitle');
const resultsSubtitle = document.getElementById('resultsSubtitle');
const metricOriginalLabel = document.getElementById('metricOriginalLabel');
const metricOriginalSize = document.getElementById('metricOriginalSize');
const metricOriginalSub = document.getElementById('metricOriginalSub');
const metricProcessedLabel = document.getElementById('metricProcessedLabel');
const metricProcessedSize = document.getElementById('metricProcessedSize');
const metricProcessedSub = document.getElementById('metricProcessedSub');
const metricRatioLabel = document.getElementById('metricRatioLabel');
const metricRatioValue = document.getElementById('metricRatioValue');
const metricRatioSub = document.getElementById('metricRatioSub');
const metricTimeValue = document.getElementById('metricTimeValue');
const downloadFileName = document.getElementById('downloadFileName');
const btnDownloadFile = document.getElementById('btnDownloadFile');
const btnResetAll = document.getElementById('btnResetAll');

// Modals (native <dialog>: focus trap, Escape to close and focus return come built in)
const teamModal = document.getElementById('teamModal');
const archModal = document.getElementById('archModal');
const btnTeamModal = document.getElementById('btnTeamModal');
const btnArchitectureModal = document.getElementById('btnArchitectureModal');
const btnCloseTeamModal = document.getElementById('btnCloseTeamModal');
const btnCloseArchModal = document.getElementById('btnCloseArchModal');

// Toast
const toastNotification = document.getElementById('toastNotification');
const toastIcon = document.getElementById('toastIcon');
const toastMessage = document.getElementById('toastMessage');
const liveAnnouncer = document.getElementById('liveAnnouncer');

// Architecture Pipeline Nodes (for visual tracking)
const archNodes = {
  input: document.getElementById('archInputFile'),
  fileManager: document.getElementById('archFileManager'),
  freqTable: document.getElementById('archFreqTable'),
  minHeap: document.getElementById('archMinHeap'),
  huffTree: document.getElementById('archHuffmanTree'),
  encoder: document.getElementById('archEncoder'),
  metadata: document.getElementById('archMetadata'),
  compressed: document.getElementById('archCompressed')
};

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupUploadListeners();
  setupSampleChips();
  setupModeSelection();
  setupModals();
});

// Setup Upload Interactions
function setupUploadListeners() {
  btnBrowse.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = pickSingleFile(e.target.files);
    if (file) handleIncomingFile(file);
  });

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    const file = pickSingleFile(e.dataTransfer.files);
    if (file) handleIncomingFile(file);
  });

  // Removing the file also cancels a job that is still running
  btnRemoveFile.addEventListener('click', () => {
    resetAll();
  });

  btnExecuteAction.addEventListener('click', () => {
    startExecutionPipeline();
  });

  btnDownloadFile.addEventListener('click', () => {
    triggerLocalDownload();
  });

  btnResetAll.addEventListener('click', () => {
    resetAll();
  });

  btnToggleTerminal.addEventListener('click', () => {
    const collapse = terminalConsole.style.display !== 'none';
    terminalConsole.style.display = collapse ? 'none' : 'block';
    btnToggleTerminal.textContent = collapse ? 'Expand' : 'Collapse';
    btnToggleTerminal.setAttribute('aria-expanded', String(!collapse));
  });

  btnToggleHistogram.addEventListener('click', () => {
    const collapse = byteHistogramBars.style.display !== 'none';
    byteHistogramBars.style.display = collapse ? 'none' : 'flex';
    btnToggleHistogram.textContent = collapse ? 'Expand' : 'Collapse';
    btnToggleHistogram.setAttribute('aria-expanded', String(!collapse));
  });
}

// Setup Quick Sample Files
function setupSampleChips() {
  const chips = document.querySelectorAll('.sample-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', async () => {
      const sampleFile = chip.getAttribute('data-sample');
      try {
        logToConsole('Loading sample test file: ' + sampleFile, 'info');
        const res = await fetch('sample_files/' + sampleFile);
        if (!res.ok) throw new Error('File not accessible');
        const blob = await res.blob();
        const file = new File([blob], sampleFile, { type: blob.type || 'text/plain' });
        handleIncomingFile(file);
        showToast('Sample file "' + sampleFile + '" loaded!');
      } catch (err) {
        logToConsole('Error loading sample file: ' + err.message, 'error');
        showToast('Could not load the sample file. Open the app through server.js (node server.js).', 'error');
      }
    });
  });
}

// Setup Mode Selection & Manual Switchers
function setupModeSelection() {
  // Manual Pill Switchers
  btnToggleCompress.addEventListener('click', () => {
    setMode('compress', true);
  });

  btnToggleDecompress.addEventListener('click', () => {
    if (!isArchiveFile(appState.currentFile)) {
      showToast('Only .shrink or .sb archives can be decompressed.', 'error');
      logToConsole('Decompression blocked: File must have a .shrink or .sb extension.', 'error');
      return;
    }
    setMode('decompress', true);
  });
}

// Setup Modals
function setupModals() {
  btnTeamModal.addEventListener('click', () => teamModal.showModal());
  btnCloseTeamModal.addEventListener('click', () => teamModal.close());

  btnArchitectureModal.addEventListener('click', () => archModal.showModal());
  btnCloseArchModal.addEventListener('click', () => archModal.close());

  // Clicking the dimmed area around the card closes the dialog
  [teamModal, archModal].forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
  });
}

// ==========================================================================
// FILE INGESTION & SMART EXTENSION DETECTION
// ==========================================================================
// Picks the file to process from a FileList, warning if more than one was supplied
// (browse dialog / drag-drop both allow multi-select, but only one file is handled).
function pickSingleFile(fileList) {
  if (!fileList || !fileList.length) return null;
  if (fileList.length > 1) {
    showToast(`${fileList.length} files selected — only "${fileList[0].name}" will be used.`);
    logToConsole(`Multiple files detected (${fileList.length}). Ignoring all but "${fileList[0].name}".`, 'error');
  }
  return fileList[0];
}

function handleIncomingFile(file) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showToast(`"${file.name}" exceeds the 1 GB size limit and was not loaded.`, 'error');
    logToConsole(`Rejected "${file.name}": size ${formatBytes(file.size)} exceeds the 1 GB limit.`, 'error');
    return;
  }

  // A new file replaces the old one, so stop any job still working on the old one
  if (activeRun) cancelActiveRun('a new file was loaded');

  appState.currentFile = file;
  appState.processedBlob = null;

  // Format file details
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);

  const ext = getFileExtension(file.name);
  fileTypeIcon.textContent = ext ? ext.toUpperCase().slice(0, 6) : 'FILE';
  fileMime.textContent = file.type || 'Binary / Raw Data';

  // Show Selected File details card
  fileDetailsCard.classList.remove('hidden');
  dropZone.classList.add('hidden');
  resultsSection.classList.add('hidden');
  progressSection.classList.add('hidden');

  // Smart Extension Analysis: only .shrink / .sb archives can be decompressed
  analyzeFileExtension(file.name);

  // Show Mode switcher bar & CTA
  modeSwitcherBar.classList.remove('hidden');
  ctaContainer.classList.remove('hidden');

  logToConsole(`File loaded: "${file.name}" (${formatBytes(file.size)})`, 'info');

  renderByteHistogram(file);
}

function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop().toLowerCase();
}

// ==========================================================================
// LIVE BYTE-FREQUENCY HISTOGRAM (real data read from the loaded file)
// ==========================================================================
const HISTOGRAM_SIZE_CAP_BYTES = 50 * 1024 * 1024; // keep the main thread responsive
const HISTOGRAM_TOP_N = 12;

// Each scan gets an id; a scan that finishes after another file was loaded is discarded
let histogramScanId = 0;

async function renderByteHistogram(file) {
  const scanId = ++histogramScanId;
  byteHistogramCard.classList.remove('hidden');
  byteHistogramBars.style.display = 'flex';
  btnToggleHistogram.textContent = 'Collapse';
  btnToggleHistogram.setAttribute('aria-expanded', 'true');
  byteHistogramBars.replaceChildren();

  if (file.size === 0) {
    byteHistogramSub.textContent = 'File is empty — nothing to analyze.';
    return;
  }

  if (file.size > HISTOGRAM_SIZE_CAP_BYTES) {
    byteHistogramSub.textContent = `Skipped — file exceeds the ${formatBytes(HISTOGRAM_SIZE_CAP_BYTES)} live-preview cap.`;
    return;
  }

  byteHistogramSub.textContent = 'Scanning byte contents...';

  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (err) {
    if (scanId !== histogramScanId) return;
    byteHistogramSub.textContent = 'Could not read the file for the preview.';
    logToConsole(`[Histogram] Could not read "${file.name}": ${err.message}`, 'error');
    return;
  }
  if (scanId !== histogramScanId) return;

  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) {
    counts[bytes[i]]++;
  }

  const ranked = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, HISTOGRAM_TOP_N);

  const maxCount = ranked.length ? ranked[0][1] : 0;
  const distinctBytes = counts.filter(c => c > 0).length;

  byteHistogramSub.textContent =
    `Top ${ranked.length} of ${distinctBytes} distinct byte values across ${bytes.length.toLocaleString()} bytes`;

  ranked.forEach(([byteValue, count]) => {
    const pct = maxCount ? (count / maxCount) * 100 : 0;
    const row = document.createElement('div');
    row.className = 'byte-histogram-row';

    const label = document.createElement('span');
    label.className = 'byte-histogram-byte-label';
    label.textContent = formatByteLabel(byteValue);

    const track = document.createElement('span');
    track.className = 'byte-histogram-bar-track';
    const fill = document.createElement('span');
    fill.className = 'byte-histogram-bar-fill';
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    const countEl = document.createElement('span');
    countEl.className = 'byte-histogram-count';
    countEl.textContent = count.toLocaleString();

    row.append(label, track, countEl);
    byteHistogramBars.appendChild(row);
  });

  logToConsole(`[Histogram] Scanned ${bytes.length.toLocaleString()} bytes — ${distinctBytes} distinct values found.`, 'info');
}

function formatByteLabel(byteValue) {
  const hex = '0x' + byteValue.toString(16).padStart(2, '0').toUpperCase();
  const isPrintable = byteValue >= 32 && byteValue <= 126;
  if (isPrintable) {
    return `'${String.fromCharCode(byteValue)}' ${hex}`;
  }
  return hex;
}

/**
 * EXTENSION VALIDATION:
 * 1. Compressed files are saved with the .shrink extension.
 * 2. Only .shrink or .sb (C++ CLI) archives can be decompressed.
 */
function analyzeFileExtension(name) {
  if (isArchiveFile(appState.currentFile)) {
    // ShrinkByte archive: authorized for decompression
    detectionBadge.textContent = 'Auto-Detected: SB01 Archive';
    btnToggleDecompress.disabled = false;
    btnToggleDecompress.classList.remove('disabled');
    btnToggleDecompress.removeAttribute('title');
    setMode('decompress', false);
    logToConsole(`Archive detected: "${name}". Auto-configured for DECOMPRESSION.`, 'success');
  } else {
    // Any other file can ONLY be compressed
    detectionBadge.textContent = 'Auto-Detected: Ready to Compress';
    btnToggleDecompress.disabled = true;
    btnToggleDecompress.classList.add('disabled');
    btnToggleDecompress.setAttribute('title', 'Only .shrink or .sb archives can be decompressed');
    setMode('compress', false);
    logToConsole(`Source file loaded: "${name}". Note: Only .shrink or .sb archives can be decompressed. Auto-configured for COMPRESSION.`, 'info');
  }
}

// Mode State Setter
function setMode(mode, userOverride = false) {
  if (mode === 'decompress' && !isArchiveFile(appState.currentFile)) {
    showToast('Only .shrink or .sb archives can be decompressed.', 'error');
    logToConsole('Decompression blocked: File lacks a .shrink or .sb extension.', 'error');
    btnToggleCompress.classList.add('active');
    btnToggleDecompress.classList.remove('active');
    return;
  }

  appState.activeMode = mode;
  btnToggleCompress.setAttribute('aria-pressed', String(mode === 'compress'));
  btnToggleDecompress.setAttribute('aria-pressed', String(mode === 'decompress'));

  if (mode === 'compress') {
    btnToggleCompress.classList.add('active');
    btnToggleDecompress.classList.remove('active');

    modeStatusText.textContent = 'Compressing file via Huffman Coding';
    btnActionLabel.textContent = 'Compress File Now';
    btnActionIcon.innerHTML = `
      <polyline points="4 14 10 14 10 20"></polyline>
      <polyline points="20 10 14 10 14 4"></polyline>
      <line x1="14" y1="10" x2="21" y2="3"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    `;

    // Configure progress labels
    uploadTitle.textContent = 'Reading File & Counting Byte Frequencies';
    processMainTitle.textContent = 'Huffman Coding Compression Pipeline';
    processSubTitle.textContent = 'Waiting for the frequency table...';
    mileStep1Label.textContent = '1. Frequency Table';
    mileStep2Label.textContent = '2. Min-Heap & Tree';
    mileStep3Label.textContent = '3. Encode & Pack Bits';
    mileStep4Label.textContent = '4. Round-Trip Check';

    if (userOverride) {
      logToConsole('User manually toggled mode to COMPRESS.', 'info');
    }
  } else {
    btnToggleDecompress.classList.add('active');
    btnToggleCompress.classList.remove('active');

    modeStatusText.textContent = 'Decompressing archive to original format';
    btnActionLabel.textContent = 'Decompress File Now';
    btnActionIcon.innerHTML = `
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    `;

    // Configure progress labels
    uploadTitle.textContent = 'Reading SB01 Header & Frequency Table';
    processMainTitle.textContent = 'Huffman Decompression Pipeline';
    processSubTitle.textContent = 'Waiting for the archive header...';
    mileStep1Label.textContent = '1. Header & Magic SB01';
    mileStep2Label.textContent = '2. Tree Rebuild';
    mileStep3Label.textContent = '3. Bitstream Decoding';
    mileStep4Label.textContent = '4. Size Check';

    if (userOverride) {
      logToConsole('User manually toggled mode to DECOMPRESS.', 'info');
    }
  }
}

// ==========================================================================
// PROCESSING PIPELINE (real progress reported by the SB01 codec)
// ==========================================================================
async function startExecutionPipeline() {
  if (!appState.currentFile || appState.isProcessing) return;

  const file = appState.currentFile;
  const isCompress = appState.activeMode === 'compress';

  // Only .shrink / .sb archives can be decompressed
  if (!isCompress && !isArchiveFile(file)) {
    showToast('Only .shrink or .sb archives can be decompressed.', 'error');
    logToConsole(`[ERROR] Decompression aborted: "${file.name}" is not a .shrink or .sb archive.`, 'error');
    return;
  }

  const run = { cancelled: false, cancel: () => { run.cancelled = true; } };
  activeRun = run;
  appState.isProcessing = true;
  btnExecuteAction.disabled = true;
  modeSwitcherBar.classList.add('hidden');
  ctaContainer.classList.add('hidden');
  resultsSection.classList.add('hidden');
  progressSection.classList.remove('hidden');

  resetMilestones();
  clearArchitectureHighlights();
  resetProgressBars();
  uploadStatusDesc.textContent = isCompress
    ? 'Reading the file in 4 MB chunks to build the 0–255 byte frequency table.'
    : 'Checking the SB01 magic, original size and frequency table.';

  const tracker = createProgressTracker(isCompress);
  const startTime = performance.now();
  logToConsole(`[Start] ${isCompress ? 'Compressing' : 'Decompressing'} "${file.name}" (${formatBytes(file.size)}) in your browser. Nothing is uploaded.`, 'info');

  try {
    const result = await runCodec(run, isCompress ? 'compress' : 'decompress', file, (p) => {
      if (run === activeRun) tracker.update(p);
    });
    if (run !== activeRun) return; // cancelled while finishing
    tracker.finish();

    const durationMs = Math.round(performance.now() - startTime);
    appState.stats.executionTimeMs = durationMs;
    appState.stats.originalSize = file.size;
    appState.stats.processedSize = result.outputSize;
    appState.stats.verified = Boolean(result.verified);
    appState.processedBlob = result.blob;
    appState.outputFileName = isCompress ? compressedName(file.name) : restoredName(file.name);

    if (isCompress) {
      logToConsole(`[Done] ${formatBytes(file.size)} → ${formatBytes(result.outputSize)} (${result.distinctBytes} distinct byte values). Round-trip check passed.`, 'success');
    } else {
      logToConsole(`[Done] Restored ${formatBytes(result.outputSize)}; size matches the SB01 header.`, 'success');
    }

    showResultsCard(isCompress);
  } catch (err) {
    if (run !== activeRun) return; // cancelled: resetAll already cleaned up
    showPipelineError(err, isCompress);
  } finally {
    if (run === activeRun) {
      activeRun = null;
      appState.isProcessing = false;
      btnExecuteAction.disabled = false;
    }
  }
}

// Runs the codec in a Web Worker; falls back to the main thread if workers are unavailable
// (for example when index.html is opened straight from disk instead of through server.js).
function runCodec(run, action, file, onProgress) {
  let worker = null;
  try {
    worker = new Worker('sb01-worker.js');
  } catch (err) {
    logToConsole('Web Worker unavailable; processing on the main thread instead.', 'info');
  }

  if (!worker) {
    const options = { onProgress, isCancelled: () => run.cancelled };
    return action === 'compress' ? SB01.compress(file, options) : SB01.decompress(file, options);
  }

  return new Promise((resolve, reject) => {
    run.cancel = () => {
      run.cancelled = true;
      worker.terminate();
      reject(new SB01.SB01Error(SB01.Status.CANCELLED));
    };
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress(msg);
        return;
      }
      worker.terminate();
      if (msg.type === 'done') {
        resolve(msg.result);
      } else {
        const error = new Error(msg.message);
        error.status = msg.status;
        reject(error);
      }
    };
    worker.onerror = (e) => {
      e.preventDefault();
      worker.terminate();
      reject(new Error(e.message || 'The compression worker failed to start.'));
    };
    worker.postMessage({ action, file });
  });
}

function cancelActiveRun(reason) {
  const run = activeRun;
  if (!run) return;
  activeRun = null;
  run.cancel();
  appState.isProcessing = false;
  btnExecuteAction.disabled = false;
  logToConsole(`Processing cancelled: ${reason}.`, 'info');
}

// Maps codec phases onto the two progress bars, the milestone chips and the architecture diagram.
// Compress:   read → (stage 1)   tree → encode → verify (stage 2)
// Decompress: read → (stage 1)   tree → decode (stage 2)
function createProgressTracker(isCompress) {
  const stage2 = isCompress
    ? { tree: [0, 5], encode: [5, 80], verify: [80, 100] }
    : { tree: [0, 5], decode: [5, 100] };
  const chips = isCompress
    ? { tree: mileStep2, encode: mileStep3, verify: mileStep4 }
    : { tree: mileStep2, decode: mileStep3 };
  const titles = isCompress
    ? {
        tree: 'Building the min-heap and merging nodes into the Huffman tree...',
        encode: 'Encoding bytes with prefix codes and packing bits into bytes...',
        verify: 'Decompressing the new archive and comparing it with the original...'
      }
    : {
        tree: 'Rebuilding the Huffman tree from the frequency table...',
        decode: 'Walking the tree bit by bit to recover the original bytes...'
      };
  const logs = isCompress
    ? {
        tree: '[MinHeap] Frequency table complete. Building the Huffman tree.',
        encode: '[HuffmanEncoder] Writing the SB01 header and encoding the bitstream.',
        verify: '[Verify] Decoding the archive to confirm it restores the original exactly.'
      }
    : {
        tree: '[MetadataManager] SB01 header is valid. Rebuilding the Huffman tree.',
        decode: '[HuffmanDecoder] Decoding the bitstream.'
      };
  const archByPhase = isCompress
    ? { read: ['input', 'fileManager', 'freqTable'], tree: ['minHeap', 'huffTree'], encode: ['encoder', 'metadata'], verify: ['compressed'] }
    : { read: ['input', 'fileManager', 'metadata'], tree: ['huffTree'], decode: ['encoder', 'compressed'] };

  let currentPhase = null;
  let readStart = performance.now();

  function enterPhase(phase) {
    if (phase === currentPhase) return;
    if (currentPhase && chips[currentPhase]) {
      chips[currentPhase].classList.remove('active');
      chips[currentPhase].classList.add('completed');
    }
    currentPhase = phase;
    (archByPhase[phase] || []).forEach(highlightArchNode);

    if (phase === 'read') {
      readStart = performance.now();
      mileStep1.classList.add('active');
      uploadStateBadge.textContent = 'Reading...';
      uploadStateBadge.className = 'state-pill in-progress';
      return;
    }

    // Leaving the read phase completes stage 1
    if (!mileStep1.classList.contains('completed')) {
      mileStep1.classList.remove('active');
      mileStep1.classList.add('completed');
      setBar(uploadProgressBar, uploadPercentText, 100);
      uploadStateBadge.textContent = 'Done ✓';
      uploadStateBadge.className = 'state-pill done';
    }
    if (chips[phase]) chips[phase].classList.add('active');
    processSubTitle.textContent = titles[phase] || processSubTitle.textContent;
    if (logs[phase]) logToConsole(logs[phase], 'info');
  }

  return {
    update({ phase, done, total }) {
      enterPhase(phase);
      const fraction = total > 0 ? Math.min(1, done / total) : 1;

      if (phase === 'read') {
        setBar(uploadProgressBar, uploadPercentText, fraction * 100);
        uploadBytesMetric.textContent = `${formatBytes(done)} / ${formatBytes(total)}`;
        const seconds = (performance.now() - readStart) / 1000;
        uploadSpeedMetric.textContent = seconds > 0.05 ? `${(done / 1048576 / seconds).toFixed(1)} MB/s` : '—';
        return;
      }

      const range = stage2[phase];
      if (range) setBar(processProgressBar, processPercentText, range[0] + (range[1] - range[0]) * fraction);
    },
    finish() {
      enterPhase('finished');
      [mileStep1, mileStep2, mileStep3, mileStep4].forEach(chip => {
        chip.classList.remove('active');
        chip.classList.add('completed');
      });
      setBar(uploadProgressBar, uploadPercentText, 100);
      setBar(processProgressBar, processPercentText, 100);
      processSubTitle.textContent = isCompress
        ? 'Archive written and verified against the original.'
        : 'Original bytes restored; size matches the header.';
    }
  };
}

function setBar(bar, label, percent) {
  const rounded = Math.round(percent);
  bar.style.width = rounded + '%';
  label.textContent = rounded + '%';
}

function showPipelineError(err, isCompress) {
  const message = err && err.message ? err.message : 'Unknown error';
  uploadStateBadge.textContent = 'Failed';
  uploadStateBadge.className = 'state-pill failed';
  processSubTitle.textContent = `Stopped: ${message}`;
  [mileStep1, mileStep2, mileStep3, mileStep4].forEach(chip => chip.classList.remove('active'));
  logToConsole(`[ERROR] ${isCompress ? 'Compression' : 'Decompression'} failed: ${message}`, 'error');
  showToast(`${isCompress ? 'Compression' : 'Decompression'} failed: ${message}`, 'error');

  // Let the user try again or pick another mode
  modeSwitcherBar.classList.remove('hidden');
  ctaContainer.classList.remove('hidden');
}

// example_code.c -> example_code.c.shrink, so decompressing restores the full original name
function compressedName(name) {
  return `${name}.shrink`;
}

// example_code.c.shrink -> example_code.c ; data.sb -> data
function restoredName(name) {
  const lower = name.toLowerCase();
  const ext = ARCHIVE_EXTENSIONS.find(e => lower.endsWith(e));
  const base = ext ? name.slice(0, -ext.length) : '';
  return base || `restored_${name}`;
}

// ==========================================================================
// RESULTS & LOCAL DOWNLOAD
// ==========================================================================
function showResultsCard(isCompress) {
  const { originalSize, processedSize } = appState.stats;
  resultsSection.classList.remove('hidden');
  metricRatioValue.classList.remove('highlight-emerald', 'highlight-warning');

  if (isCompress) {
    resultsTitle.textContent = 'Compression Complete';
    resultsSubtitle.textContent = appState.stats.verified
      ? 'Round-trip verified: decompressing the archive gave back every byte of the original.'
      : 'Archive written.';
    metricOriginalLabel.textContent = 'Original File Size';
    metricOriginalSub.textContent = 'Raw input bytes';
    metricProcessedLabel.textContent = 'Compressed Size';
    metricProcessedSub.textContent = 'SB01 header + bitstream';

    const saved = originalSize - processedSize;
    if (originalSize === 0) {
      metricRatioLabel.textContent = 'Space Saved';
      metricRatioValue.textContent = '—';
      metricRatioSub.textContent = 'Empty input: the archive is just the header';
    } else if (saved >= 0) {
      metricRatioLabel.textContent = 'Space Saved';
      metricRatioValue.textContent = `${((saved / originalSize) * 100).toFixed(1)}%`;
      metricRatioValue.classList.add('highlight-emerald');
      metricRatioSub.textContent = `${formatBytes(saved)} smaller`;
    } else {
      metricRatioLabel.textContent = 'Size Change';
      metricRatioValue.textContent = `+${((-saved / originalSize) * 100).toFixed(1)}% larger`;
      metricRatioValue.classList.add('highlight-warning');
      metricRatioSub.textContent = `${formatBytes(-saved)} added: the header and codes outweigh the savings for this file`;
    }
  } else {
    resultsTitle.textContent = 'Decompression Complete';
    resultsSubtitle.textContent = 'Every byte decoded; the restored size matches the SB01 header.';
    metricOriginalLabel.textContent = 'Archive Size';
    metricOriginalSub.textContent = 'SB01 input';
    metricProcessedLabel.textContent = 'Decompressed Size';
    metricProcessedSub.textContent = 'Restored original bytes';
    metricRatioLabel.textContent = 'Payload Expansion';
    const change = originalSize > 0 ? ((processedSize - originalSize) / originalSize) * 100 : 0;
    metricRatioValue.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    metricRatioSub.textContent = 'Full file recovered';
  }

  metricOriginalSize.textContent = formatBytes(originalSize);
  metricProcessedSize.textContent = formatBytes(processedSize);
  metricTimeValue.textContent = `${appState.stats.executionTimeMs} ms`;
  downloadFileName.textContent = appState.outputFileName;

  // Scroll smoothly to results (instantly when the user prefers reduced motion)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  resultsSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
}

// Trigger Local Download (100% Client-Side In-Memory)
function triggerLocalDownload() {
  if (!appState.processedBlob || !appState.outputFileName) {
    showToast('No processed file ready for download.', 'error');
    return;
  }

  // Create temporary in-memory object URL
  const downloadUrl = URL.createObjectURL(appState.processedBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = appState.outputFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke immediately to maintain zero footprint in memory
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 1000);

  logToConsole(`File "${appState.outputFileName}" downloaded to user disk.`, 'success');
  showToast(`Downloaded "${appState.outputFileName}" to your computer!`);
}

// ==========================================================================
// UI HELPER UTILITIES
// ==========================================================================
function resetAll() {
  if (activeRun) cancelActiveRun('the file was removed');
  histogramScanId++; // discard a histogram scan that is still reading

  appState.currentFile = null;
  appState.processedBlob = null;
  appState.outputFileName = '';
  appState.isProcessing = false;
  btnExecuteAction.disabled = false;
  fileInput.value = '';

  fileDetailsCard.classList.add('hidden');
  byteHistogramCard.classList.add('hidden');
  byteHistogramBars.replaceChildren();
  modeSwitcherBar.classList.add('hidden');
  ctaContainer.classList.add('hidden');
  progressSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  dropZone.classList.remove('hidden');

  btnToggleDecompress.disabled = false;
  btnToggleDecompress.classList.remove('disabled');
  btnToggleDecompress.removeAttribute('title');

  resetMilestones();
  clearArchitectureHighlights();
  resetProgressBars();

  terminalConsole.replaceChildren();
  logToConsole('Session reset. Ready for next file.', 'info');
}

function resetProgressBars() {
  setBar(uploadProgressBar, uploadPercentText, 0);
  setBar(processProgressBar, processPercentText, 0);
  uploadBytesMetric.textContent = '0 Bytes';
  uploadSpeedMetric.textContent = '—';
  uploadStateBadge.textContent = 'Waiting...';
  uploadStateBadge.className = 'state-pill in-progress';
}

function resetMilestones() {
  [mileStep1, mileStep2, mileStep3, mileStep4].forEach(chip => {
    chip.classList.remove('active', 'completed');
  });
}

function highlightArchNode(nodeKey) {
  if (archNodes[nodeKey]) {
    archNodes[nodeKey].classList.add('node-active');
  }
}

function clearArchitectureHighlights() {
  Object.values(archNodes).forEach(node => {
    if (node) node.classList.remove('node-active');
  });
}

function logToConsole(message, type = 'info') {
  const line = document.createElement('div');
  line.className = 'log-line';

  const d = new Date();
  const timeStr = `[${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(Math.floor(d.getMilliseconds() / 10)).padStart(2, '0')}]`;

  let typeSpan = `<span class="log-info">[INFO]</span>`;
  if (type === 'success') typeSpan = `<span class="log-success">[SUCCESS]</span>`;
  if (type === 'error') typeSpan = `<span class="log-error">[ERROR]</span>`;

  line.innerHTML = `<span class="log-time">${timeStr}</span> ${typeSpan} ${escapeHtml(message)}`;
  terminalConsole.appendChild(line);
  terminalConsole.scrollTop = terminalConsole.scrollHeight;
}

let toastHideTimer = null;

// type: 'info' (check icon) or 'error' (warning icon); also read out by screen readers
function showToast(msg, type = 'info') {
  const isError = type === 'error';
  toastMessage.textContent = msg;
  toastIcon.textContent = isError ? '!' : '✓';
  toastNotification.classList.toggle('toast-error', isError);
  toastNotification.classList.remove('hidden');

  liveAnnouncer.textContent = '';
  liveAnnouncer.textContent = msg;

  if (toastHideTimer) clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    toastNotification.classList.add('hidden');
    toastHideTimer = null;
  }, isError ? 6000 : 3500);
}

function formatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes)) return '—';
  const sign = bytes < 0 ? '-' : '';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${sign}${abs} ${abs === 1 ? 'Byte' : 'Bytes'}`;
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(abs) / Math.log(k)), sizes.length - 1);
  return sign + parseFloat((abs / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
