import LZString from 'lz-string';

self.onmessage = (e) => {
  const { id, type, payload } = e.data;
  try {
    if (type === 'compress') {
      const compressed = LZString.compressToBase64(payload);
      self.postMessage({ id, type: 'success', payload: compressed });
    } else if (type === 'decompress') {
      const decompressed = LZString.decompressFromBase64(payload);
      self.postMessage({ id, type: 'success', payload: decompressed });
    }
  } catch (error: any) {
    self.postMessage({ id, type: 'error', error: error.message });
  }
};
