const form = document.querySelector('#search-form');
const input = document.querySelector('#search-input');
const clearButton = document.querySelector('#clear-button');
const luckyButton = document.querySelector('#lucky-button');
const categories = document.querySelectorAll('.category');

const categoryOptions = {
  web: '',
  images: 'images',
  videos: 'videos',
  news: 'news',
};

let activeCategory = 'web';

function search(query = input.value) {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    input.focus();
    return;
  }

  const destination = new URL('https://duckduckgo.com/');
  destination.searchParams.set('q', cleanedQuery);
  const vertical = categoryOptions[activeCategory];
  if (vertical) destination.searchParams.set('ia', vertical);
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
