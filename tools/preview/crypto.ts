export const randomUUID = () =>
  globalThis.crypto?.randomUUID?.() ??
  "preview-" + Date.now() + "-" + Math.random().toString(36).slice(2);
