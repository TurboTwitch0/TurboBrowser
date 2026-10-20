const form = document.querySelector('#search-form');
const input = document.querySelector('#search-input');
const clearButton = document.querySelector('#clear-button');
const luckyButton = document.querySelector('#lucky-button');
const categories = document.querySelectorAll('.category');
const providerToggle = document.querySelector('#provider-toggle');
const providerName = document.querySelector('#provider-name');
const providerMenu = document.querySelector('#provider-menu');
const providerOptions = document.querySelectorAll('.provider-option');

const categoryOptions = {
  web: '',
  images: 'images',
  videos: 'videos',
  news: 'news',
};

let activeCategory = 'web';
const providers = {
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/',
    parameter: 'q',
    categories: { images: 'images', videos: 'videos', news: 'news' },
    categoryParameter: 'ia',
  },
  google: {
    name: 'Google',
    url: 'https://www.google.com/search',
    parameter: 'q',
    categories: { images: 'isch', videos: 'vid', news: 'nws' },
    categoryParameter: 'tbm',
  },
  yahoo: {
    name: 'Yahoo',
    urls: {
      web: 'https://search.yahoo.com/search',
      images: 'https://images.search.yahoo.com/search/images',
      videos: 'https://video.search.yahoo.com/search/video',
      news: 'https://news.search.yahoo.com/search',
    },
    parameter: 'p',
  },
  bing: {
    name: 'Bing',
    urls: {
      web: 'https://www.bing.com/search',
      images: 'https://www.bing.com/images/search',
      videos: 'https://www.bing.com/videos/search',
      news: 'https://www.bing.com/news/search',
    },
    parameter: 'q',
  },
};
const savedProvider = localStorage.getItem('turbobrowser-provider');
let activeProvider = providers[savedProvider] ? savedProvider : 'duckduckgo';

function setProvider(providerKey) {
  if (!providers[providerKey]) return;
  activeProvider = providerKey;
  localStorage.setItem('turbobrowser-provider', providerKey);
  providerName.textContent = providers[providerKey].name;
  providerOptions.forEach((option) => {
    const selected = option.dataset.provider === providerKey;
    option.setAttribute('aria-checked', String(selected));
    option.classList.toggle('selected', selected);
  });
}

function closeProviderMenu() {
  providerMenu.hidden = true;
  providerToggle.setAttribute('aria-expanded', 'false');
}

function search(query = input.value) {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    input.focus();
    return;
  }

  const provider = providers[activeProvider];
  const destination = new URL(provider.urls?.[activeCategory] || provider.url);
  destination.searchParams.set(provider.parameter, cleanedQuery);
  const vertical = provider.categories?.[activeCategory];
  if (vertical) destination.searchParams.set(provider.categoryParameter, vertical);
  window.location.assign(destination.toString());
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  search();
});

input.addEventListener('input', () => {
  clearButton.hidden = input.value.length === 0;
});

clearButton.addEventListener('click', () => {
  input.value = '';
  clearButton.hidden = true;
  input.focus();
});

luckyButton.addEventListener('click', () => {
  const ideas = [
    'beautiful places to visit',
    'how do solar panels work',
    'easy weeknight dinner ideas',
    'the history of the internet',
    'new things to learn today',
  ];
  const query = input.value.trim() || ideas[Math.floor(Math.random() * ideas.length)];
  search(query);
});

categories.forEach((button) => {
  button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    categories.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    input.focus();
  });
});

setProvider(activeProvider);

providerToggle.addEventListener('click', () => {
  const isOpen = providerToggle.getAttribute('aria-expanded') === 'true';
  providerToggle.setAttribute('aria-expanded', String(!isOpen));
  providerMenu.hidden = isOpen;
  if (!isOpen) providerOptions[0].focus();
});

providerOptions.forEach((option) => {
  option.addEventListener('click', () => {
    setProvider(option.dataset.provider);
    closeProviderMenu();
    providerToggle.focus();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !providerMenu.hidden) {
    closeProviderMenu();
    providerToggle.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.provider-picker')) closeProviderMenu();
});
