(() => {
  const config = window.TURBO_AD_CONFIG;
  if (!config || !/^ca-pub-\d{16}$/.test(config.publisherId || '')) return;

  const slots = Object.entries(config.slots || {})
    .map(([placement, slotId]) => ({
      container: document.querySelector(`[data-ad-placement="${placement}"]`),
      slotId,
    }))
    .filter(({ container, slotId }) => container && /^\d+$/.test(slotId || ''));

  if (!slots.length) return;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.publisherId)}`;
  script.onload = () => {
    slots.forEach(({ container, slotId }) => {
      const ad = container.querySelector('.adsbygoogle');
      ad.dataset.adClient = config.publisherId;
      ad.dataset.adSlot = slotId;
      container.classList.add('ad-enabled');
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        container.classList.remove('ad-enabled');
        console.error('TurboBrowser ad placement could not load.', error);
      }
    });
  };
  script.onerror = () => console.error('TurboBrowser could not load the ad provider script.');
  document.head.append(script);
})();
