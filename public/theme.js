// Apply before CSS/React paint. Preference belongs to this device.
(() => {
  let preference = 'system';
  try {
    const stored = localStorage.getItem('open-timelog-theme');
    if (['system', 'light', 'dark'].includes(stored)) preference = stored;
  } catch {}
  const dark =
    preference === 'dark' ||
    (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();
