import { providers, categoryNames, buildSearchUrl, normalizeUrl, normalizeArticle, normalizeShortcuts } from './browser-core.mjs';
import { createShowcase } from './showcase.mjs';

const $ = (selector) => document.querySelector(selector);
const form = $('#search-form');
const input = $('#search-input');
const clearButton = $('#clear-button');
const categoryButtons = [...document.querySelectorAll('.category')];
const providerToggle = $('#provider-toggle');
const providerMenu = $('#provider-menu');
const providerOptions = [...document.querySelectorAll('.provider-option')];
const cards = $('#daily-cards');
const dialog = $('#shortcut-dialog');
const storageKeys = { provider: 'turbobrowser-provider', shortcuts: 'turbobrowser-shortcuts', saved: 'turbobrowser-saved' };
let toastTimer;

function notify(message, undo, focusTarget) {
  const status = $('#status-message');
  clearTimeout(toastTimer);
  status.textContent = message;
  if (undo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-undo';
    button.textContent = 'Undo';
    button.addEventListener('click', () => { status.hidden = true; undo(); if (focusTarget) $(focusTarget)?.focus(); });
    status.append(' ', button);
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'toast-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss message');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => { status.hidden = true; if (focusTarget) $(focusTarget)?.focus(); });
    status.append(dismiss);
  }
  status.hidden = false;
  if (!undo) toastTimer = setTimeout(() => { status.hidden = true; }, 6000);
}

function readRaw(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function readJson(key) {
  try { return JSON.parse(readRaw(key)); } catch { return null; }
}
function persist(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch { notify('Browser storage is unavailable. Changes last for this visit.'); return false; }
}
function normalizedSaved(value) {
  return Array.isArray(value) ? [...new Map(value.map(normalizeArticle).filter(Boolean).map((item) => [item.url, item])).values()].slice(0, 100) : [];
}

const rememberedProvider = readRaw(storageKeys.provider);
let activeProvider = Object.hasOwn(providers, rememberedProvider) ? rememberedProvider : 'duckduckgo';
let activeCategory = 'web';
let shortcuts = normalizeShortcuts(readJson(storageKeys.shortcuts));
let saved = normalizedSaved(readJson(storageKeys.saved));
let editingShortcuts = false;
let editingShortcutUrl = null;
let dailyItems = [];
let feedState = 'loading';
let showSaved = false;
let refreshing = false;
let feedMessage = '';
let dailyDescription = 'Featured and popular articles from Wikipedia.';
const showcaseRoot = $('#reading-showcase');
const showcase = createShowcase({ root: showcaseRoot, onToggleSave: (item, button) => toggleSaved(item, button), isSaved });

function updateSearchForm() {
  const provider = providers[activeProvider];
  const destination = buildSearchUrl(activeProvider, activeCategory, '');
  form.action = destination.origin + destination.pathname;
  input.name = provider.parameter;
  input.placeholder = activeCategory === 'web' ? 'What are you curious about?' : `Search ${activeCategory} with ${provider.name}`;
  const parameter = $('#category-parameter');
  parameter.disabled = !provider.categories?.[activeCategory];
  parameter.name = provider.categoryParameter || '';
  parameter.value = provider.categories?.[activeCategory] || '';
}
function setProvider(key, remember = true) {
  if (!Object.hasOwn(providers, key)) return;
  activeProvider = key;
  if (remember) persist(storageKeys.provider, key);
  $('#provider-name').textContent = providers[key].name;
  $('#provider-symbol').textContent = providers[key].symbol;
  $('#provider-symbol').className = `provider-dot ${key}`;
  providerOptions.forEach((option) => {
    option.setAttribute('aria-checked', String(option.dataset.provider === key));
    option.tabIndex = -1;
  });
  updateSearchForm();
}
function closeProviderMenu(restoreFocus = false) {
  providerMenu.hidden = true;
  providerToggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) providerToggle.focus();
}
function openProviderMenu() {
  providerMenu.hidden = false;
  providerToggle.setAttribute('aria-expanded', 'true');
  providerOptions.find((option) => option.dataset.provider === activeProvider).focus();
}
providerToggle.addEventListener('click', () => providerMenu.hidden ? openProviderMenu() : closeProviderMenu());
providerToggle.addEventListener('keydown', (event) => {
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openProviderMenu(); }
});
providerOptions.forEach((option) => option.addEventListener('click', () => { setProvider(option.dataset.provider); closeProviderMenu(true); }));
providerMenu.addEventListener('keydown', (event) => {
  const index = providerOptions.indexOf(document.activeElement);
  const moves = { ArrowDown: (index + 1) % providerOptions.length, ArrowUp: (index + providerOptions.length - 1) % providerOptions.length, Home: 0, End: providerOptions.length - 1 };
  if (Object.hasOwn(moves, event.key)) { event.preventDefault(); providerOptions[moves[event.key]].focus(); }
  if (event.key === 'Escape') { event.preventDefault(); closeProviderMenu(true); }
  if (event.key === 'Tab') closeProviderMenu(true);
});
providerMenu.addEventListener('focusout', (event) => {
  if (!event.relatedTarget || !event.relatedTarget.closest('.provider-picker')) closeProviderMenu();
});
document.addEventListener('click', (event) => { if (!event.target.closest('.provider-picker')) closeProviderMenu(); });

form.addEventListener('submit', (event) => {
  input.value = input.value.trim();
  clearButton.hidden = !input.value;
  if (!input.value) { event.preventDefault(); input.focus(); return; }
  updateSearchForm();
});
input.addEventListener('input', () => { clearButton.hidden = !input.value; });
clearButton.addEventListener('click', () => { input.value = ''; clearButton.hidden = true; input.focus(); });
categoryButtons.forEach((button) => button.addEventListener('click', () => {
  if (!categoryNames.includes(button.dataset.category)) return;
  activeCategory = button.dataset.category;
  categoryButtons.forEach((item) => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-pressed', String(item === button));
  });
  updateSearchForm();
  input.focus();
}));
$('#lucky-button').addEventListener('click', () => {
  const ideas = ['beautiful places to visit', 'how do solar panels work', 'easy weeknight dinner ideas', 'the history of the internet', 'new things to learn today'];
  if (!input.value.trim()) input.value = ideas[Math.floor(Math.random() * ideas.length)];
  form.requestSubmit();
});
document.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  const typing = event.target.closest('input, textarea, select, [contenteditable]');
  const searchShortcut = (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey);
  if (searchShortcut && !dialog.open) { event.preventDefault(); input.focus(); input.select(); }
  if (event.key === 'Escape' && !providerMenu.hidden) closeProviderMenu(true);
});

function makeLink(url, className) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = className;
  return link;
}
function makeSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}
function makeArrow() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'external-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M7 17 17 7M7 7h10v10');
  svg.append(path);
  return svg;
}

function renderShortcuts() {
  $('#shortcuts').replaceChildren(...shortcuts.map((item, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'shortcut-wrap';
    const link = makeLink(item.url, 'shortcut');
    const icon = makeSpan('shortcut-icon', Array.from(item.name)[0].toUpperCase());
    icon.setAttribute('aria-hidden', 'true');
    const arrow = makeSpan('shortcut-arrow', '');
    arrow.append(makeArrow());
    arrow.setAttribute('aria-hidden', 'true');
    link.append(icon, makeSpan('', item.name), arrow);
    link.title = `${item.name} — ${new URL(item.url).hostname} (opens in a new tab)`;
    wrap.append(link);
    if (editingShortcuts) {
      wrap.classList.add('is-editing');
      const tools = document.createElement('div');
      tools.className = 'shortcut-tools';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'edit-shortcut';
      edit.textContent = 'Edit';
      edit.setAttribute('aria-label', `Edit ${item.name} shortcut`);
      edit.addEventListener('click', () => openShortcutDialog(item));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-shortcut';
      remove.setAttribute('aria-label', `Remove ${item.name} shortcut`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        shortcuts.splice(index, 1);
        const stored = persist(storageKeys.shortcuts, JSON.stringify(shortcuts));
        renderShortcuts();
        $('#edit-shortcuts').focus();
        if (stored) notify(`${item.name} removed.`, () => {
          if (shortcuts.some((shortcut) => shortcut.url === item.url)) return;
          if (shortcuts.length >= 8) { notify('All eight shortcut spaces are in use. Remove one before restoring this shortcut.'); return; }
          shortcuts.splice(Math.min(index, shortcuts.length), 0, item);
          persist(storageKeys.shortcuts, JSON.stringify(shortcuts));
          renderShortcuts();
        }, '#edit-shortcuts');
      });
      tools.append(edit, remove);
      wrap.append(tools);
    }
    return wrap;
  }));
  if (!shortcuts.length) {
    const empty = document.createElement('div');
    empty.className = 'shortcuts-empty';
    const symbol = makeSpan('', '');
    symbol.append(makeArrow());
    symbol.setAttribute('aria-hidden', 'true');
    empty.append(symbol, 'A little space for your favorite places. Add your first shortcut below.');
    $('#shortcuts').append(empty);
  }
  $('#edit-shortcuts').textContent = editingShortcuts ? 'Done' : 'Edit';
  $('#edit-shortcuts').setAttribute('aria-pressed', String(editingShortcuts));
  $('#edit-shortcuts').hidden = false;
  $('#add-shortcut').hidden = shortcuts.length >= 8;
}
$('#edit-shortcuts').addEventListener('click', () => { editingShortcuts = !editingShortcuts; renderShortcuts(); });
function openShortcutDialog(item = null) {
  editingShortcutUrl = item?.url || null;
  $('#shortcut-form').reset();
  $('#shortcut-dialog-title').textContent = item ? 'Make it yours.' : 'One less click.';
  $('#shortcut-dialog-description').textContent = item ? 'Update this shortcut without moving it from your launchpad.' : 'Add a favorite place to your everyday launchpad.';
  $('#shortcut-submit-label').textContent = item ? 'Save changes' : 'Add shortcut';
  $('#shortcut-name').value = item?.name || '';
  $('#shortcut-url').value = item?.url || '';
  $('#shortcut-error').textContent = '';
  $('#shortcut-url').removeAttribute('aria-invalid');
  dialog.showModal();
  $('#shortcut-name').select();
}
$('#add-shortcut').addEventListener('click', () => openShortcutDialog());
dialog.addEventListener('close', () => {
  const target = editingShortcutUrl || $('#add-shortcut').hidden ? '#edit-shortcuts' : '#add-shortcut';
  $(target).focus();
});
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#cancel-shortcut').addEventListener('click', () => dialog.close());
$('#shortcut-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#shortcut-name').value.trim();
  const url = normalizeUrl($('#shortcut-url').value, true);
  const editingIndex = editingShortcutUrl ? shortcuts.findIndex((item) => item.url === editingShortcutUrl) : -1;
  let error = '';
  if (!name) error = 'Give your shortcut a name.';
  else if (!url) error = 'Enter a valid website address, such as https://example.com.';
  else if (editingShortcutUrl && editingIndex === -1) error = 'This shortcut changed in another tab. Close this dialog and try again.';
  else if (shortcuts.some((item, index) => item.url === url && index !== editingIndex)) error = 'That website is already in your shortcuts.';
  else if (!editingShortcutUrl && shortcuts.length >= 8) error = 'You can keep up to eight shortcuts. Remove one to make room.';
  if (error) { $('#shortcut-error').textContent = error; $('#shortcut-url').setAttribute('aria-invalid', String(!url)); (!name ? $('#shortcut-name') : $('#shortcut-url')).focus(); return; }
  const updated = { name: name.slice(0, 32), url };
  if (editingIndex !== -1) shortcuts[editingIndex] = updated;
  else shortcuts.push(updated);
  const stored = persist(storageKeys.shortcuts, JSON.stringify(shortcuts));
  renderShortcuts();
  dialog.close();
  if ($('#add-shortcut').hidden) $('#edit-shortcuts').focus();
  if (stored) notify(editingIndex !== -1 ? `${name} shortcut updated.` : `${name} added to your shortcuts.`);
});

function updateSavedCounts() {
  $('#saved-count').textContent = saved.length;
  $('#filter-count').textContent = saved.length;
}
function isSaved(item) { return saved.some((article) => article.url === item.url); }
function updateSaveButton(button, item) {
  button.setAttribute('aria-pressed', String(isSaved(item)));
  button.setAttribute('aria-label', `${isSaved(item) ? 'Remove from' : 'Save to'} reading list: ${item.title}`);
  button.title = isSaved(item) ? 'Remove from reading list' : 'Save for later';
}
function toggleSaved(item, button) {
  const wasSaved = isSaved(item);
  if (!wasSaved && saved.length >= 100) { notify('Your reading list has 100 articles. Remove one to save another.'); return; }
  saved = wasSaved ? saved.filter((article) => article.url !== item.url) : [item, ...saved];
  const stored = persist(storageKeys.saved, JSON.stringify(saved));
  updateSavedCounts();
  if (showSaved) { renderPicks(); $('#saved-filter').focus(); }
  else {
    updateSaveButton(button, item);
    cards.querySelectorAll('.save-article').forEach((otherButton) => {
      if (otherButton.dataset.articleUrl === item.url) updateSaveButton(otherButton, item);
    });
  }
  showcase.syncSaved();
  if (stored) notify(wasSaved ? 'Removed from your reading list.' : 'Saved to your reading list in this browser.', wasSaved ? () => {
    if (isSaved(item)) return;
    if (saved.length >= 100) { notify('Your reading list is full. Remove one article before restoring this one.'); return; }
    saved = [item, ...saved];
    persist(storageKeys.saved, JSON.stringify(saved));
    updateSavedCounts();
    renderPicks();
  } : undefined, '#saved-filter');
}
function makeArticle(item, index) {
  const card = document.createElement('article');
  card.className = `daily-card${index === 0 && !showSaved ? ' featured' : ''}`;
  const link = makeLink(item.url, 'article-link');
  link.title = `${item.title} (opens in a new tab)`;
  const heading = document.createElement('h3');
  heading.className = 'daily-card-title';
  heading.textContent = item.title;
  link.append(makeSpan('daily-card-kind', item.kind), heading);
  if (item.description) {
    const description = document.createElement('p');
    description.className = 'daily-card-description';
    description.textContent = item.description;
    link.append(description);
  }
  if (index === 0 && !showSaved && item.thumbnail) {
    const image = document.createElement('img');
    image.src = item.thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.className = 'article-image';
    image.addEventListener('error', () => image.remove());
    link.append(image);
  }
  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const host = new URL(item.url).hostname;
  const source = makeSpan('article-source', host.endsWith('.wikipedia.org') ? 'Wikipedia' : host);
  source.append(makeArrow());
  bottom.append(source);
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save-article';
  save.dataset.articleUrl = item.url;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M6 4h12v17l-6-4-6 4V4Z');
  svg.append(path);
  save.append(svg);
  updateSaveButton(save, item);
  save.addEventListener('click', () => toggleSaved(item, save));
  bottom.append(save);
  card.append(link, bottom);
  return card;
}
function renderState(title, text, kind) {
  const state = document.createElement('div');
  state.className = 'daily-state';
  const symbol = makeSpan('state-icon', kind === 'error' ? '↻' : '↗');
  symbol.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const copy = makeSpan('state-copy', text);
  state.append(symbol, heading, copy);
  const actions = document.createElement('div');
  actions.className = 'state-actions';
  if (kind === 'saved') {
    const explore = document.createElement('button');
    explore.type = 'button';
    explore.className = 'action-button primary';
    explore.textContent = 'Explore fresh picks ↗';
    explore.addEventListener('click', () => { setFeedFilter(false); $('#all-filter').focus(); });
    actions.append(explore);
  }
  if (kind === 'filtered') {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'action-button primary';
    clear.textContent = 'Clear search';
    clear.addEventListener('click', () => { $('#saved-search').value = ''; renderPicks(); $('#saved-search').focus(); });
    actions.append(clear);
  }
  if (kind === 'error') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button primary';
    button.textContent = 'Try again';
    button.addEventListener('click', () => { $('#daily-title').focus({ preventScroll: true }); loadDailyPicks(); });
    actions.append(button);
    const fallback = makeLink('https://en.wikipedia.org/wiki/Main_Page', 'action-button');
    fallback.textContent = 'Explore Wikipedia ↗';
    actions.append(fallback);
  }
  state.append(actions);
  cards.replaceChildren(state);
}
function renderLoading() {
  const message = document.createElement('p');
  message.className = 'loading-message';
  message.textContent = 'Finding your next good read…';
  const grid = document.createElement('div');
  grid.className = 'loading-grid';
  grid.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index++) {
    const card = document.createElement('div');
    card.className = 'loading-card';
    for (let line = 0; line < 4; line++) card.append(makeSpan('skeleton-line', ''));
    grid.append(card);
  }
  cards.replaceChildren(message, grid);
}
function renderPicks() {
  $('#daily-eyebrow').textContent = showSaved ? 'YOUR PERSONAL SHELF' : 'A FRESH PERSPECTIVE';
  $('#daily-title').textContent = showSaved ? 'Good reads. Kept close.' : 'A little discovery. Every day.';
  $('#daily-description').textContent = showSaved ? 'A reading list for your curious side. Saved in this browser, ready when you are.' : dailyDescription;
  $('#daily-date').hidden = showSaved || !dailyItems.length;
  $('#refresh-feed').hidden = showSaved;
  $('#feed-notice').hidden = showSaved || !feedMessage;
  $('#feed-notice').textContent = feedMessage;
  $('#reading-tools').hidden = !showSaved || !saved.length;
  cards.dataset.view = showSaved ? 'saved' : feedState;
  showcaseRoot.hidden = showSaved || feedState !== 'ready' || dailyItems.length === 0;
  $('#more-picks-label').hidden = showSaved || feedState !== 'ready' || dailyItems.length < 2;
  showcase.syncSaved();
  const fold = (value) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  const query = fold($('#saved-search').value.trim());
  const items = showSaved ? saved.filter((item) => fold(`${item.title} ${item.description} ${item.kind}`).includes(query)) : dailyItems;
  $('#reading-results').textContent = query ? `${items.length} of ${saved.length} saved reads` : `${saved.length} saved ${saved.length === 1 ? 'read' : 'reads'}`;
  if (items.length) {
    const gridItems = showSaved ? items : items.slice(1);
    cards.replaceChildren(...gridItems.map((item, index) => makeArticle(item, index + 1)));
  }
  else if (showSaved && saved.length && query) renderState('No reads found.', 'Try a different title, topic, or article type. Your saved articles are still here.', 'filtered');
  else if (showSaved) renderState('Your next good read starts here.', 'Bookmark a fresh pick and it will be waiting here. No account needed. Just this browser.', 'saved');
  else if (feedState === 'loading') renderLoading();
  else renderState('A small pause in discovery.', 'Fresh picks couldn’t load. Try again, visit Wikipedia, or open your saved reads. Search still works.', 'error');
  cards.setAttribute('aria-busy', String(!showSaved && feedState === 'loading'));
}
function setFeedFilter(value) {
  showSaved = value;
  [$('#all-filter'), $('#saved-filter')].forEach((button, index) => {
    const active = index === Number(value);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  renderPicks();
}
$('#all-filter').addEventListener('click', () => setFeedFilter(false));
$('#saved-filter').addEventListener('click', () => setFeedFilter(true));
$('#saved-nav').addEventListener('click', () => setFeedFilter(true));
$('#saved-search').addEventListener('input', renderPicks);
$('#refresh-feed').addEventListener('click', loadDailyPicks);

async function loadDailyPicks() {
  if (refreshing) return;
  refreshing = true;
  const refreshButton = $('#refresh-feed');
  refreshButton.disabled = true;
  refreshButton.setAttribute('aria-label', 'Refreshing published picks');
  $('#refresh-label').textContent = 'Refreshing…';
  feedState = dailyItems.length ? 'ready' : 'loading';
  feedMessage = '';
  renderPicks();
  try {
    const response = await fetch('./daily-content.json', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Daily content request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('No daily articles received');
    const nextItems = [...new Map(data.items.map(normalizeArticle).filter(Boolean).map((item) => [item.url, item])).values()].slice(0, 12);
    if (!nextItems.length) throw new Error('No valid daily articles received');
    dailyItems = nextItems;
    showcase.setItems(dailyItems);
    dailyDescription = typeof data.description === 'string' ? data.description : 'Featured and popular articles from Wikipedia.';
    const updated = typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : new Date(NaN);
    const label = $('#daily-date');
    if (!Number.isNaN(updated.valueOf())) {
      label.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(updated)}`;
      label.title = `Last refreshed ${updated.toLocaleString()}`;
      if (Date.now() - updated.valueOf() > 48 * 60 * 60 * 1000) feedMessage = 'Showing the last available picks. The next daily update may be delayed.';
    } else {
      label.textContent = 'Update time unavailable';
      label.removeAttribute('title');
    }
    feedState = 'ready';
  } catch {
    feedState = dailyItems.length ? 'ready' : 'error';
    feedMessage = dailyItems.length ? 'Couldn’t refresh right now. Your loaded picks are still available; try Refresh again in a moment.' : '';
  }
  refreshing = false;
  refreshButton.disabled = false;
  refreshButton.setAttribute('aria-label', 'Reload the latest published Wikipedia picks');
  $('#refresh-label').textContent = 'Refresh';
  renderPicks();
}

window.addEventListener('storage', (event) => {
  if (event.key === storageKeys.provider || event.key === null) {
    const key = readRaw(storageKeys.provider);
    setProvider(Object.hasOwn(providers, key) ? key : 'duckduckgo', false);
  }
  if (event.key === storageKeys.saved || event.key === null) { saved = normalizedSaved(readJson(storageKeys.saved)); updateSavedCounts(); renderPicks(); }
  if (event.key === storageKeys.shortcuts || event.key === null) { shortcuts = normalizeShortcuts(readJson(storageKeys.shortcuts)); renderShortcuts(); }
});
setProvider(activeProvider, false);
renderShortcuts();
updateSavedCounts();
loadDailyPicks();
