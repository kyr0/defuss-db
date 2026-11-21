export const formatMs = (n) => (n < 1 ? n.toFixed(3) : n.toFixed(2));

export function feedCaption(runtime, backend, indexed, scan) {
  const label = runtime === 'Node' ? 'Node.js' : runtime;
  const storage = backend === 'memory' ? 'memory' : 'directory';
  const count = (n) => n.toLocaleString('en-US');
  return (
    label +
    ' · ' +
    storage +
    '. Compound index ' +
    formatMs(indexed.medianMs) +
    ' ms (' +
    count(indexed.scannedRows) +
    ' rows examined). Collection scan ' +
    formatMs(scan.medianMs) +
    ' ms (' +
    count(scan.scannedRows) +
    ' rows examined).'
  );
}
