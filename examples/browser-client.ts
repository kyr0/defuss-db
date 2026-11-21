// Run from a bundled browser application; browsers require a secure origin for OPFS.
const worker = new Worker(new URL('./browser-worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = ({ data }) => console.log(data);
worker.postMessage({ action: 'increment' });
// Call worker.terminate() when the application no longer needs this worker.
