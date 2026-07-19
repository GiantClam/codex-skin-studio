const screenButtons = document.querySelectorAll('[data-screen]');
const panels = document.querySelectorAll('[data-screen-panel]');

function showScreen(screen) {
  panels.forEach((panel) => panel.classList.toggle('is-visible', panel.dataset.screenPanel === screen));
  document.querySelectorAll('.view-button, .rail-link').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.screen === screen);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

screenButtons.forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screen)));

const searchInput = document.querySelector('#theme-search');
const resultCards = document.querySelectorAll('[data-search-card]');
const resultCount = document.querySelector('#result-count');
let activeTarget = 'all';

function applyResultFilters() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  let visible = 0;
  resultCards.forEach((card) => {
    const matchesQuery = !query || card.dataset.searchCard.includes(query);
    const matchesTarget = activeTarget === 'all' || card.dataset.targets.split(' ').includes(activeTarget);
    const isVisible = matchesQuery && matchesTarget;
    card.classList.toggle('is-hidden', !isVisible);
    if (isVisible) visible += 1;
  });
  if (resultCount) resultCount.textContent = `${String(visible).padStart(2, '0')} results`;
}

searchInput?.addEventListener('input', applyResultFilters);

document.querySelector('#clear-filters')?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  activeTarget = 'all';
  document.querySelectorAll('[data-target-filter]').forEach((button) => button.classList.toggle('is-selected', button.dataset.targetFilter === 'all'));
  applyResultFilters();
});

document.querySelectorAll('[data-target-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    activeTarget = button.dataset.targetFilter;
    document.querySelectorAll('[data-target-filter]').forEach((item) => item.classList.toggle('is-selected', item === button));
    applyResultFilters();
  });
});

document.querySelectorAll('.filter-option').forEach((button) => {
  button.addEventListener('click', () => {
    const group = button.closest('.filter-group');
    group?.querySelectorAll('.filter-option').forEach((item) => item.classList.remove('is-selected'));
    button.classList.add('is-selected');
  });
});

document.querySelector('#publish-button')?.addEventListener('click', (event) => {
  event.currentTarget.textContent = 'Published ✓';
  event.currentTarget.style.background = 'var(--green)';
});
