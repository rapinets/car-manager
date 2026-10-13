const API_URL = 'https://car-catalog-xgkc.onrender.com/cars/';
const PAGE_SIZE = 10;

const homeListElement = document.querySelector('#latest-list');
const catalogListElement = document.querySelector('#catalog-list');
const loaderElement = document.querySelector('#loading-state');
const catalogFilters = document.querySelector('#catalog-filters');
const prevButton = document.querySelector('#prev-page');
const nextButton = document.querySelector('#next-page');
const offsetValue = document.querySelector('#offset-value');
const addCarButton = document.querySelector('#add-car-button');
const carForm = document.querySelector('#car-form');

const catalogState = {
  offset: 0,
  filters: {
    car_make_model: '',
    fuel_type: '',
    year: '',
  },
};

function formatPrice(price) {
  if (price === null || price === undefined || price === '') {
    return '—';
  }

  const numericPrice = Number(price);

  if (Number.isNaN(numericPrice)) {
    return String(price);
  }

  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(numericPrice);
}

function capitalize(text) {
  if (!text) {
    return '—';
  }

  return String(text).replace(/_/g, ' ');
}

function renderCarCard(car, options = {}) {
  const { showActions = false } = options;
  const availableLabel = car.is_available ? 'Доступно' : 'Не доступно';
  const availableClass = car.is_available ? 'badge--available' : 'badge--unavailable';
  const carId = car.id ?? '';

  const actionsMarkup = showActions
    ? `
      <div class="car-card__actions">
        <button type="button" class="secondary-button car-card__action" data-action="edit" data-id="${carId}">Редагувати</button>
        <button type="button" class="danger-button car-card__action" data-action="delete" data-id="${carId}">Видалити</button>
      </div>
    `
    : '';

  return `
    <article class="car-card" data-id="${carId}">
      <div class="car-card__top">
        <h2 class="car-card__title">
          <a href="./details.html?id=${carId}">${car.car_make_model ?? 'Автомобіль'}</a>
        </h2>
        <span class="badge ${availableClass}">${availableLabel}</span>
      </div>

      <div class="car-card__meta">
        <div class="car-card__meta-item">
          <span class="car-card__meta-label">Кузов</span>
          <span>${capitalize(car.body)}</span>
        </div>
        <div class="car-card__meta-item">
          <span class="car-card__meta-label">Паливо</span>
          <span>${capitalize(car.fuel_type)}</span>
        </div>
        <div class="car-card__meta-item">
          <span class="car-card__meta-label">Ціна</span>
          <span>${formatPrice(car.price)}</span>
        </div>
        <div class="car-card__meta-item">
          <span class="car-card__meta-label">Рік</span>
          <span>${car.year ?? '—'}</span>
        </div>
        <div class="car-card__meta-item">
          <span class="car-card__meta-label">Рейтинг</span>
          <span>${car.rating ?? '—'}</span>
        </div>
      </div>

      ${actionsMarkup}

      <div class="car-card__footer">
        <a class="details-link" href="./details.html?id=${carId}">Більше →</a>
      </div>
    </article>
  `;
}

function ensureErrorBanner() {
  let banner = document.querySelector('#global-error-banner');

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'global-error-banner';
    banner.className = 'error-banner';
    banner.setAttribute('role', 'alert');
    banner.hidden = true;

    const pageMain = document.querySelector('main');

    if (pageMain) {
      pageMain.insertBefore(banner, pageMain.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  return banner;
}

function showErrorBanner(message) {
  const banner = ensureErrorBanner();

  if (!message) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }

  banner.textContent = message;
  banner.hidden = false;
}

function hideErrorBanner() {
  showErrorBanner('');
}

function getApiErrorMessage(status, payload) {
  const text = typeof payload === 'string' ? payload : '';
  const normalized = text.toLowerCase();

  if (status === 409) {
    if (normalized.includes('vin')) {
      return 'Автомобіль з таким VIN вже існує';
    }

    if (normalized.includes('number') || normalized.includes('номер')) {
      return 'Автомобіль з таким номерним знаком вже існує';
    }

    return 'Автомобіль з такими даними вже існує';
  }

  if (status === 404) {
    return 'Авто не знайдено (можливо, вже видалена)';
  }

  if (status === 422) {
    return 'Перевірте правильність заповнення форми';
  }

  if (normalized.includes('vin')) {
    return 'Автомобіль з таким VIN вже існує';
  }

  if (normalized.includes('number') || normalized.includes('номер')) {
    return 'Автомобіль з таким номерним знаком вже існує';
  }

  return 'Не вдалося з\'єднатися з сервером. Перевірте, чи запущений бекенд';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let payload = '';

    try {
      payload = await response.text();
    } catch (error) {
      payload = '';
    }

    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function getCarIdFromQuery() {
  return new URLSearchParams(window.location.search).get('id');
}

function setFormMode(isEditMode) {
  const formTitle = document.querySelector('#form-title');

  if (formTitle) {
    formTitle.textContent = isEditMode ? 'Редагувати автомобіль' : 'Додати автомобіль';
  }
}

function formatHumanDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function fetchCarById(carId) {
  const car = await fetchJson(`${API_URL}${carId}`);

  if (!car || typeof car !== 'object') {
    throw new Error('Received invalid car payload');
  }

  return car;
}

async function fillCarFormForEdit() {
  const carId = getCarIdFromQuery();

  if (!carId || !carForm) {
    return;
  }

  setFormMode(true);

  try {
    const car = await fetchCarById(carId);
    const isAvailableField = document.getElementById('is_available');

    if (!carForm || !car) {
      return;
    }

    Object.entries({
      number: car.number,
      car_make_model: car.car_make_model,
      automaker: car.automaker,
      vin: car.vin,
      body: car.body,
      fuel_type: car.fuel_type,
      price: car.price,
      rating: car.rating,
      year: car.year,
      summary: car.summary,
      additional_options: Array.isArray(car.additional_options) ? car.additional_options.join(', ') : car.additional_options,
    }).forEach(([fieldName, value]) => {
      const field = document.getElementById(fieldName);

      if (field) {
        field.value = value ?? '';
      }
    });

    if (isAvailableField) {
      isAvailableField.value = String(Boolean(car.is_available));
    }
  } catch (error) {
    console.error('Error loading car for edit:', error);
    showErrorBanner('Не вдалося завантажити дані автомобіля для редагування.');
    setTimeout(() => {
      window.location.href = './catalog.html';
    }, 1200);
  }
}

function buildDetailsMarkup(car) {
  const options = Array.isArray(car.additional_options) ? car.additional_options : [];
  const availableText = car.is_available ? 'Доступно' : 'Не доступно';
  let optionsMarkup = '';
  if (options.length > 0 || options !== "string") {
    optionsMarkup = `<ul class="detail-options-list">${options.map((option) => `<li>${option}</li>`).join('')}</ul>`;
  } else {
    optionsMarkup = '<div class="detail-empty-state">Додаткових опцій немає</div>';
  }

  return `
    <article class="details-card">
      <div class="details-header">
        <div>
          <p class="eyebrow">Автомобіль</p>
          <h1>${car.car_make_model ?? 'Автомобіль'}</h1>
        </div>
        <div class="availability-tag ${car.is_available ? 'availability-tag--available' : 'availability-tag--unavailable'}">${availableText}</div>
      </div>

      <div class="details-subheader">
        <p class="details-automaker">${car.automaker ?? 'Автопроизводитель'}</p>
        <p class="details-added">Додано: ${formatHumanDate(car.added_at)}</p>
      </div>

      <div class="details-grid">
        <div class="detail-row"><span>Номер</span><strong>${car.number ?? '—'}</strong></div>
        <div class="detail-row"><span>VIN</span><strong>${car.vin ?? '—'}</strong></div>
        <div class="detail-row"><span>Кузов</span><strong>${capitalize(car.body)}</strong></div>
        <div class="detail-row"><span>Паливо</span><strong>${capitalize(car.fuel_type)}</strong></div>
        <div class="detail-row"><span>Рік</span><strong>${car.year ?? '—'}</strong></div>
      </div>

      <div class="details-highlight-grid">
        <div class="price-block">
          <span>Ціна</span>
          <strong>${formatPrice(car.price)}</strong>
        </div>
        <div class="rating-block">
          <span>Рейтинг</span>
          <strong>${car.rating ?? '—'}</strong>
        </div>
      </div>

      <section class="details-section details-section--summary">
        <h2>Опис</h2>
        <p>${car.summary ? String(car.summary).replace(/\n/g, '<br>') : 'Опис відсутній'}</p>
      </section>

      <section class="details-section">
        <h2>Додаткові опції</h2>
        ${optionsMarkup}
      </section>

      <div class="details-actions">
        <a class="primary-button" href="./form.html?id=${car.id ?? ''}">Редагувати</a>
        <button type="button" class="danger-button" data-action="delete-detail" data-id="${car.id ?? ''}">Видалити</button>
      </div>
    </article>
  `;
}

async function loadCarDetails() {
  const carId = getCarIdFromQuery();
  const container = document.getElementById('details-container');

  if (!carId || !container) {
    return;
  }

  try {
    const car = await fetchCarById(carId);
    container.innerHTML = buildDetailsMarkup(car);

    const deleteButton = container.querySelector('[data-action="delete-detail"]');
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        const isConfirmed = window.confirm('Ви впевнені, що хочете видалити цей автомобіль?');

        if (!isConfirmed) {
          return;
        }

        fetch(`${API_URL}${carId}`, { method: 'DELETE' })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
            }

            window.location.href = './catalog.html';
          })
          .catch((error) => {
            console.error('Error deleting car from details:', error);
            showErrorBanner('Авто не знайдено (можливо, вже видалена)');
          });
      });
    }
  } catch (error) {
    console.error('Error loading car details:', error);
    showErrorBanner('Авто не знайдено (можливо, вже видалена)');
    container.innerHTML = '<div class="empty-state">Автомобіль не знайдено</div>';
  }
}

function handleCatalogAction(event) {
  const actionButton = event.target.closest('[data-action]');

  if (!actionButton) {
    return;
  }

  const carId = actionButton.dataset.id;

  if (!carId) {
    return;
  }

  if (actionButton.dataset.action === 'edit') {
    window.location.href = `./form.html?id=${carId}`;
    return;
  }

  if (actionButton.dataset.action === 'delete') {
    const isConfirmed = window.confirm('Ви впевнені, що хочете видалити цей автомобіль?');

    if (!isConfirmed) {
      return;
    }

    fetchJson(`${API_URL}${carId}`, { method: 'DELETE' })
      .then(() => {
        const card = actionButton.closest('.car-card');

        if (card) {
          card.remove();
        }

        hideErrorBanner();
      })
      .catch((error) => {
        console.error('Error deleting car:', error);
        showErrorBanner(getApiErrorMessage(error.status, error.payload));
      });
  }
}

function renderEmptyState(targetElement) {
  if (!targetElement) {
    return;
  }

  targetElement.innerHTML = '<div class="empty-state">Автомобілів поки немає</div>';
}

function buildCarsUrl({ offset = 0, limit = PAGE_SIZE, filters = {} } = {}) {
  const params = new URLSearchParams();

  if (filters.car_make_model) {
    params.set('car_make_model', filters.car_make_model);
  }

  if (filters.fuel_type) {
    params.set('fuel_type', filters.fuel_type);
  }

  if (filters.year) {
    params.set('year', String(filters.year));
  }

  params.set('limit', String(limit));
  params.set('offset', String(offset));

  return `${API_URL}?${params.toString()}`;
}

async function fetchCars({ offset = 0, limit = PAGE_SIZE, filters = {} } = {}) {
  const cars = await fetchJson(buildCarsUrl({ offset, limit, filters }));

  if (!Array.isArray(cars)) {
    throw new Error('Received invalid response payload');
  }

  return cars;
}

async function loadLatestCars() {
  if (!homeListElement || !loaderElement) {
    return;
  }

  loaderElement.hidden = false;
  homeListElement.innerHTML = '';

  try {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const cars = await fetchCars({ limit: 5, offset: 0 });
    loaderElement.hidden = true;

    if (cars.length === 0) {
      renderEmptyState(homeListElement);
      return;
    }

    homeListElement.innerHTML = cars.map((car) => renderCarCard(car, { showActions: false })).join('');
  } catch (error) {
    console.error('Error loading latest cars:', error);
    loaderElement.hidden = true;
    renderEmptyState(homeListElement);
    showErrorBanner(getApiErrorMessage(error.status, error.payload));
  }
}

function updatePaginationState(cars) {
  if (!prevButton || !nextButton || !offsetValue) {
    return;
  }

  prevButton.disabled = catalogState.offset === 0;
  nextButton.disabled = cars.length < PAGE_SIZE;
  offsetValue.textContent = `Offset: ${catalogState.offset}`;
}

async function loadCatalogCars() {
  if (!catalogListElement || !loaderElement) {
    return;
  }

  loaderElement.hidden = false;
  catalogListElement.innerHTML = '';

  try {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const cars = await fetchCars({
      offset: catalogState.offset,
      limit: PAGE_SIZE,
      filters: catalogState.filters,
    });

    loaderElement.hidden = true;
    hideErrorBanner();

    if (cars.length === 0) {
      renderEmptyState(catalogListElement);
      updatePaginationState([]);
      return;
    }

    catalogListElement.innerHTML = cars.map((car) => renderCarCard(car, { showActions: true })).join('');
    updatePaginationState(cars);
  } catch (error) {
    console.error('Error loading catalog cars:', error);
    loaderElement.hidden = true;
    renderEmptyState(catalogListElement);
    updatePaginationState([]);
    showErrorBanner(getApiErrorMessage(error.status, error.payload));
  }
}

function handleCatalogSubmit(event) {
  event.preventDefault();

  catalogState.offset = 0;
  catalogState.filters = {
    car_make_model: document.querySelector('#filter-make-model')?.value || '',
    fuel_type: document.querySelector('#filter-fuel-type')?.value || '',
    year: document.querySelector('#filter-year')?.value || '',
  };

  loadCatalogCars();
}

function handleNextPage() {
  if (catalogState.offset < 0) {
    catalogState.offset = 0;
  }

  catalogState.offset += PAGE_SIZE;
  loadCatalogCars();
}

function handlePrevPage() {
  if (catalogState.offset <= 0) {
    catalogState.offset = 0;
    return;
  }

  catalogState.offset = Math.max(0, catalogState.offset - PAGE_SIZE);
  loadCatalogCars();
}

function initializeCatalogPage() {
  if (!catalogFilters) {
    return;
  }

  catalogFilters.addEventListener('submit', handleCatalogSubmit);

  if (prevButton) {
    prevButton.addEventListener('click', handlePrevPage);
  }

  if (nextButton) {
    nextButton.addEventListener('click', handleNextPage);
  }

  if (addCarButton) {
    addCarButton.addEventListener('click', () => {
      window.location.href = './form.html';
    });
  }

  loadCatalogCars();
}

function clearFieldError(fieldName) {
  const errorElement = document.querySelector(`[data-error-for="${fieldName}"]`);

  if (errorElement) {
    errorElement.textContent = '';
  }

  const field = document.getElementById(fieldName);

  if (field) {
    field.classList.remove('invalid');
  }
}

function setFieldError(fieldName, message) {
  const errorElement = document.querySelector(`[data-error-for="${fieldName}"]`);

  if (errorElement) {
    errorElement.textContent = message;
  }

  const field = document.getElementById(fieldName);

  if (field) {
    field.classList.add('invalid');
  }
}

function validateRequiredText(fieldName, value, maxLength, label) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    setFieldError(fieldName, `${label} є обов'язковим`);
    return false;
  }

  if (trimmed.length > maxLength) {
    setFieldError(fieldName, `${label} не може перевищувати ${maxLength} символів`);
    return false;
  }

  clearFieldError(fieldName);
  return true;
}

function validateNumberField(fieldName, value, label, minValue, maxValue, required = true) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue && !required) {
    clearFieldError(fieldName);
    return true;
  }

  if (!rawValue) {
    setFieldError(fieldName, `${label} є обов'язковим`);
    return false;
  }

  const numericValue = Number(rawValue);

  if (Number.isNaN(numericValue) || numericValue < minValue || (maxValue !== null && numericValue > maxValue)) {
    setFieldError(fieldName, `${label} має бути в межах ${minValue}..${maxValue ?? 'максимум'}`);
    return false;
  }

  clearFieldError(fieldName);
  return true;
}

function validateOptionalRating(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    clearFieldError('rating');
    return true;
  }

  const rating = Number(rawValue);

  if (Number.isNaN(rating) || rating < 0 || rating > 5) {
    setFieldError('rating', 'Рейтинг повинен бути від 0 до 5');
    return false;
  }

  clearFieldError('rating');
  return true;
}

function validateOptionalSummary(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    clearFieldError('summary');
    return true;
  }

  if (rawValue.length > 2000) {
    setFieldError('summary', 'Опис не може перевищувати 2000 символів');
    return false;
  }

  clearFieldError('summary');
  return true;
}

function validateOptionalAdditionalOptions(value) {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    clearFieldError('additional_options');
    return true;
  }

  const items = rawValue.split(',').map((item) => item.trim()).filter(Boolean);

  if (items.length > 10) {
    setFieldError('additional_options', 'Не більше 10 додаткових опцій');
    return false;
  }

  clearFieldError('additional_options');
  return true;
}

function validateCarForm(event) {
  event.preventDefault();

  const formData = new FormData(carForm);

  const payload = {};
  const errors = [];
  const carId = getCarIdFromQuery();

  const numberValue = String(formData.get('number') ?? '').trim().toUpperCase();
  if (!/^[ABCEHIKMOPTX]{2}\d{4}[ABCEHIKMOPTX]{2}$/.test(numberValue)) {
    setFieldError('number', 'Номер має бути у форматі AB1234CD');
    errors.push('number');
  } else {
    clearFieldError('number');
    payload.number = numberValue;
  }

  const makeModelValue = String(formData.get('car_make_model') ?? '').trim();
  if (!validateRequiredText('car_make_model', makeModelValue, 200, 'Марка і модель')) {
    errors.push('car_make_model');
  } else {
    payload.car_make_model = makeModelValue;
  }

  const automakerValue = String(formData.get('automaker') ?? '').trim();
  if (!validateRequiredText('automaker', automakerValue, 200, 'Автопроизводитель')) {
    errors.push('automaker');
  } else {
    payload.automaker = automakerValue;
  }

  const vinValue = String(formData.get('vin') ?? '').trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vinValue)) {
    setFieldError('vin', 'VIN має містити 17 символів без літер I, O, Q');
    errors.push('vin');
  } else {
    clearFieldError('vin');
    payload.vin = vinValue;
  }

  const bodyValue = String(formData.get('body') ?? '').trim();
  if (!['sedan', 'hatchback', 'station_wagon', 'coupe', 'cabriolet', 'crossover', 'SUV', 'minivan', 'pickup_truck'].includes(bodyValue)) {
    setFieldError('body', 'Оберіть тип кузова');
    errors.push('body');
  } else {
    clearFieldError('body');
    payload.body = bodyValue;
  }

  const fuelValue = String(formData.get('fuel_type') ?? '').trim();
  if (!['gasoline', 'diesel', 'gas', 'electric'].includes(fuelValue)) {
    setFieldError('fuel_type', 'Оберіть тип палива');
    errors.push('fuel_type');
  } else {
    clearFieldError('fuel_type');
    payload.fuel_type = fuelValue;
  }

  const isAvailableValue = String(formData.get('is_available') ?? '').trim();
  if (!['true', 'false'].includes(isAvailableValue)) {
    setFieldError('is_available', 'Оберіть доступність автомобіля');
    errors.push('is_available');
  } else {
    clearFieldError('is_available');
    payload.is_available = isAvailableValue === 'true';
  }

  const priceValue = String(formData.get('price') ?? '').trim();
  if (!validateNumberField('price', priceValue, 'Ціна', 0, null, true)) {
    errors.push('price');
  } else {
    payload.price = Number(priceValue);
  }

  if (!validateOptionalRating(formData.get('rating'))) {
    errors.push('rating');
  } else if (String(formData.get('rating') ?? '').trim()) {
    payload.rating = Number(formData.get('rating'));
  }

  const yearValue = String(formData.get('year') ?? '').trim();
  if (!validateNumberField('year', yearValue, 'Рік', 1900, 2026, true)) {
    errors.push('year');
  } else {
    payload.year = Number(yearValue);
  }

  if (!validateOptionalSummary(formData.get('summary'))) {
    errors.push('summary');
  } else if (String(formData.get('summary') ?? '').trim()) {
    payload.summary = String(formData.get('summary')).trim();
  }

  if (!validateOptionalAdditionalOptions(formData.get('additional_options'))) {
    errors.push('additional_options');
  } else if (String(formData.get('additional_options') ?? '').trim()) {
    payload.additional_options = String(formData.get('additional_options')).split(',').map((item) => item.trim()).filter(Boolean);
  }

  if (errors.length > 0) {
    return;
  }

  const requestUrl = carId ? `${API_URL}${carId}` : API_URL;
  const requestMethod = carId ? 'PATCH' : 'POST';

  fetchJson(requestUrl, {
    method: requestMethod,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
    .then(() => {
      hideErrorBanner();
      window.location.href = './catalog.html';
    })
    .catch((error) => {
      console.error('Error saving car:', error);
      showErrorBanner(getApiErrorMessage(error.status, error.payload));
    });
}

window.addEventListener('DOMContentLoaded', () => {
  if (homeListElement) {
    loadLatestCars();
  }

  if (catalogListElement) {
    initializeCatalogPage();
    catalogListElement.addEventListener('click', handleCatalogAction);
  }

  if (document.getElementById('details-container')) {
    loadCarDetails();
  }

  if (carForm) {
    const isEditMode = Boolean(getCarIdFromQuery());
    setFormMode(isEditMode);
    if (isEditMode) {
      fillCarFormForEdit();
    }

    carForm.addEventListener('submit', validateCarForm);
    const numberInput = document.getElementById('number');
    if (numberInput) {
      numberInput.addEventListener('input', () => {
        numberInput.value = numberInput.value.toUpperCase();
      });
    }

    const vinInput = document.getElementById('vin');
    if (vinInput) {
      vinInput.addEventListener('input', () => {
        vinInput.value = vinInput.value.toUpperCase();
      });
    }

    const isAvailableField = document.getElementById('is_available');
    if (isAvailableField && !isEditMode) {
      isAvailableField.value = 'true';
    }
  }
});
