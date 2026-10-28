import { normalizeArticle } from './browser-core.mjs';

/** Wrap a zero-based selection without allowing missing or invalid counts. */
export function wrapShowcaseIndex(index, count) {
  if (!Number.isSafeInteger(count) || count <= 0) return 0;
  const position = Number.isSafeInteger(index) ? index : 0;
  return ((position % count) + count) % count;
}

/** Return null for unrelated keys, so normal page and control keys stay native. */
export function showcaseIndexForKey(key, index, count) {
  if (!Number.isSafeInteger(count) || count < 2) return null;
  const current = wrapShowcaseIndex(index, count);
  if (key === 'ArrowLeft') return wrapShowcaseIndex(current - 1, count);
  if (key === 'ArrowRight') return wrapShowcaseIndex(current + 1, count);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function normalizeShowcaseItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map(normalizeArticle).filter((item) => {
    if (!item || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).slice(0, 12);
}

/** A user-controlled view of real feed entries. It owns no network or storage. */
export function createShowcase({ root, onToggleSave, isSaved = () => false }) {
  if (!root) return { setItems() {}, syncSaved() {} };
  const find = (selector) => root.querySelector(selector);
  const stage = find('.showcase-stage');
  const slide = find('#showcase-slide');
  const kind = find('#showcase-kind');
  const title = find('#showcase-title');
  const description = find('#showcase-description');
  const image = find('#showcase-image');
  const open = find('#showcase-open');
  const save = find('#showcase-save');
  const previous = find('#showcase-prev');
  const next = find('#showcase-next');
  const count = find('#showcase-count');
  const announcement = find('#showcase-announcement');
  const leftPreview = find('#showcase-preview-left');
  const rightPreview = find('#showcase-preview-right');
  if (![stage, slide, kind, title, description, image, open, save, previous, next, count, announcement].every(Boolean)) {
    root.hidden = true;
    return { setItems() {}, syncSaved() {} };
  }

  let items = [];
  let index = 0;
  let transition;
  const failedImages = new Set();
  root.hidden = true;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  image.alt = '';

  function syncSaved() {
    const item = items[index];
    save.disabled = !item;
    if (!item) return;
    const selected = Boolean(isSaved(item));
    save.setAttribute('aria-pressed', String(selected));
    save.setAttribute('aria-label', `${selected ? 'Remove from' : 'Save to'} reading list: ${item.title}`);
    save.title = selected ? 'Remove from reading list' : 'Save for later';
    const label = save.querySelector('.showcase-save-label');
    if (label) label.textContent = selected ? 'Saved' : 'Save for later';
  }

  function render({ announce = false, direction = 'initial' } = {}) {
    root.hidden = items.length === 0;
    if (!items.length) return;
    index = wrapShowcaseIndex(index, items.length);
    const item = items[index];
    root.dataset.activeIndex = String(index);
    root.dataset.direction = direction;
    kind.textContent = item.kind || 'Wikipedia';
    title.textContent = item.title;
    description.textContent = item.description;
    description.hidden = !item.description;
    open.href = item.url;
    open.setAttribute('aria-label', `Read ${item.title} (opens in a new tab)`);
    slide.setAttribute('aria-label', `${index + 1} of ${items.length}: ${item.title}`);
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    previous.disabled = items.length < 2;
    next.disabled = items.length < 2;

    if (leftPreview) {
      leftPreview.textContent = items[wrapShowcaseIndex(index - 1, items.length)].title;
      (leftPreview.closest('.showcase-backcard') || leftPreview).hidden = items.length < 3;
    }
    if (rightPreview) {
      rightPreview.textContent = items[wrapShowcaseIndex(index + 1, items.length)].title;
      (rightPreview.closest('.showcase-backcard') || rightPreview).hidden = items.length < 2;
    }

    const hasImage = Boolean(item.thumbnail && !failedImages.has(item.thumbnail));
    image.hidden = !hasImage;
    slide.classList.toggle('has-image', hasImage);
    if (hasImage) {
      if (image.getAttribute('src') !== item.thumbnail) image.src = item.thumbnail;
    } else image.removeAttribute('src');
    syncSaved();
    if (announce) announcement.textContent = `Pick ${index + 1} of ${items.length}: ${item.title}`;
  }

  function select(position, direction) {
    if (items.length < 2) return;
    const nextIndex = wrapShowcaseIndex(position, items.length);
    if (nextIndex === index) return;
    index = nextIndex;
    render({ announce: true, direction });
    transition?.cancel();
    const view = root.ownerDocument?.defaultView;
    const reducedMotion = typeof view?.matchMedia !== 'function' || view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion && typeof slide.animate === 'function') {
      const offset = direction === 'previous' ? -8 : 8;
      transition = slide.animate([{ opacity: .65, transform: `translateX(${offset}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' });
    }
  }

  previous.addEventListener('click', () => select(index - 1, 'previous'));
  next.addEventListener('click', () => select(index + 1, 'next'));
  save.addEventListener('click', () => {
    const item = items[index];
    if (item && typeof onToggleSave === 'function') {
      onToggleSave(item, save);
      syncSaved();
    }
  });
  image.addEventListener('error', () => {
    if (!items[index] || image.getAttribute('src') !== items[index].thumbnail) return;
    failedImages.add(items[index].thumbnail);
    image.hidden = true;
    slide.classList.remove('has-image');
  });
  root.addEventListener('keydown', (event) => {
    // Keep all links, Save, text fields and modified browser shortcuts native.
    if (![stage, previous, next].includes(event.target) || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const destination = showcaseIndexForKey(event.key, index, items.length);
    if (destination === null) return;
    event.preventDefault();
    select(destination, event.key === 'ArrowLeft' || event.key === 'Home' ? 'previous' : 'next');
  });

  return {
    setItems(value) {
      const selectedUrl = items[index]?.url;
      items = normalizeShowcaseItems(value);
      index = Math.max(0, items.findIndex((item) => item.url === selectedUrl));
      render();
    },
    syncSaved,
  };
}
