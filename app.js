import { providers, categoryNames, buildSearchUrl, normalizeUrl, normalizeArticle, normalizeShortcuts } from './browser-core.mjs';

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

function notify(message, undo) {
  const status = $('#status-message');
  clearTimeout(toastTimer);
  status.textContent = message;
  if (undo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-undo';
    button.textContent = 'Undo';
    button.addEventListener('click', () => { undo(); status.hidden = true; });
    status.append(' ', button);
  }
  status.hidden = false;
  toastTimer = setTimeout(() => { status.hidden = true; }, undo ? 10000 : 6000);
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
let dailyItems = [];
let feedState = 'loading';
let showSaved = false;

function updateSearchForm() {
  const provider = providers[activeProvider];
  const destination = buildSearchUrl(activeProvider, activeCategory, '');
  form.action = destination.origin + destination.pathname;
  input.name = provider.parameter;
  input.placeholder = activeCategory === 'web' ? 'Where will your curiosity take you?' : `Search ${activeCategory} with ${provider.name}`;
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
  const typing = event.target.closest('input, textarea, select, [contenteditable]');
  if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey && !dialog.open) { event.preventDefault(); input.focus(); }
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

function renderShortcuts() {
  $('#shortcuts').replaceChildren(...shortcuts.map((item, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'shortcut-wrap';
    const link = makeLink(item.url, 'shortcut');
    const icon = makeSpan('shortcut-icon', Array.from(item.name)[0].toUpperCase());
    icon.setAttribute('aria-hidden', 'true');
    const arrow = makeSpan('shortcut-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(icon, makeSpan('', item.name), arrow);
    link.title = `${item.name} — ${new URL(item.url).hostname} (opens in a new tab)`;
    wrap.append(link);
    if (editingShortcuts) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-shortcut';
      remove.setAttribute('aria-label', `Remove ${item.name} shortcut`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        const before = [...shortcuts];
        shortcuts.splice(index, 1);
        const stored = persist(storageKeys.shortcuts, JSON.stringify(shortcuts));
        renderShortcuts();
        $('#edit-shortcuts').focus();
        if (stored) notify(`${item.name} removed.`, () => { shortcuts = before; persist(storageKeys.shortcuts, JSON.stringify(shortcuts)); renderShortcuts(); });
      });
      wrap.append(remove);
    }
    return wrap;
  }));
  $('#edit-shortcuts').textContent = editingShortcuts ? 'Done' : 'Edit';
  $('#edit-shortcuts').setAttribute('aria-pressed', String(editingShortcuts));
  $('#edit-shortcuts').hidden = false;
  $('#add-shortcut').hidden = shortcuts.length >= 8;
}
$('#edit-shortcuts').addEventListener('click', () => { editingShortcuts = !editingShortcuts; renderShortcuts(); });
$('#add-shortcut').addEventListener('click', () => {
  $('#shortcut-form').reset();
  $('#shortcut-error').textContent = '';
  $('#shortcut-url').removeAttribute('aria-invalid');
  dialog.showModal();
});
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#cancel-shortcut').addEventListener('click', () => dialog.close());
$('#shortcut-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#shortcut-name').value.trim();
  const url = normalizeUrl($('#shortcut-url').value, true);
  let error = '';
  if (!name) error = 'Give your shortcut a name.';
  else if (!url) error = 'Enter a valid website address, such as https://example.com.';
  else if (shortcuts.some((item) => item.url === url)) error = 'That website is already in your shortcuts.';
  else if (shortcuts.length >= 8) error = 'You can keep up to eight shortcuts. Remove one to make room.';
  if (error) { $('#shortcut-error').textContent = error; $('#shortcut-url').setAttribute('aria-invalid', String(!url)); (!name ? $('#shortcut-name') : $('#shortcut-url')).focus(); return; }
  shortcuts.push({ name: name.slice(0, 32), url });
  const stored = persist(storageKeys.shortcuts, JSON.stringify(shortcuts));
  renderShortcuts();
  dialog.close();
  if ($('#add-shortcut').hidden) $('#edit-shortcuts').focus();
  if (stored) notify(`${name} added to your shortcuts.`);
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
  else updateSaveButton(button, item);
  if (stored) notify(wasSaved ? 'Removed from your reading list.' : 'Saved to your reading list in this browser.');
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
  bottom.append(makeSpan('article-source', `${host.endsWith('.wikipedia.org') ? 'Wikipedia' : host} ↗`));
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save-article';
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
function renderState(title, text, retry = false) {
  const state = document.createElement('div');
  state.className = 'daily-state';
  const heading = document.createElement('strong');
  heading.textContent = title;
  state.append(heading, text);
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    button.textContent = 'Try again';
    button.addEventListener('click', loadDailyPicks);
    state.append(document.createElement('br'), button);
    const fallback = makeLink('https://en.wikipedia.org/wiki/Main_Page', 'action-button');
    fallback.textContent = 'Explore Wikipedia ↗';
    state.append(fallback);
  }
  cards.replaceChildren(state);
}
function renderPicks() {
  const items = showSaved ? saved : dailyItems;
  if (items.length) cards.replaceChildren(...items.map(makeArticle));
  else if (showSaved) renderState('Make room for a good read.', 'Use the bookmark on any fresh pick to keep it here. Your reading list stays in this browser.');
  else if (feedState === 'loading') renderState('Finding something interesting…', 'Your fresh picks are on their way.');
  else renderState('Fresh picks couldn’t load.', 'You can still search the web or open your saved articles.', true);
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

async function loadDailyPicks() {
  feedState = 'loading';
  renderPicks();
  try {
    const response = await fetch('./daily-content.json', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Daily content request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('No daily articles received');
    dailyItems = [...new Map(data.items.map(normalizeArticle).filter(Boolean).map((item) => [item.url, item])).values()].slice(0, 12);
    if (!dailyItems.length) throw new Error('No valid daily articles received');
    $('#daily-description').textContent = typeof data.description === 'string' ? data.description : 'Featured and popular articles from Wikipedia.';
    const updated = new Date(data.updatedAt);
    if (!Number.isNaN(updated.valueOf())) {
      const label = $('#daily-date');
      label.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(updated)}`;
      label.title = `Last refreshed ${updated.toLocaleString()}`;
    }
    feedState = 'ready';
  } catch { dailyItems = []; feedState = 'error'; }
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
