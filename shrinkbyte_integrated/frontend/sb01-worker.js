/**
 * Runs the SB01 codec off the main thread so large files never freeze the page.
 * Message in:  { action: 'compress' | 'decompress', file }
 * Messages out: { type: 'progress', phase, done, total }
 *               { type: 'done', result }
 *               { type: 'error', status, message }
 * The page cancels a job by terminating this worker.
 */
importScripts('sb01.js');

self.onmessage = async (event) => {
  const { action, file } = event.data;
  const options = {
    onProgress: (p) => self.postMessage({ type: 'progress', ...p })
  };

  try {
    const result = action === 'compress'
      ? await SB01.compress(file, options)
      : await SB01.decompress(file, options);
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({
      type: 'error',
      status: err.status || 'UNKNOWN',
      message: err.message || 'Unknown error'
    });
  }
};
