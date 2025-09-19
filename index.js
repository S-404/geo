const SERVICE_REQUEST_URL = `https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=`

document.addEventListener('DOMContentLoaded', function () {
  // Элементы для вкладки GeoJSON
  const geojsonInput = document.getElementById('geojsonInput');
  const processGeojsonButton = document.getElementById('processGeojsonButton');
  const geojsonResultDiv = document.getElementById('geojsonResult');
  const geojsonStatusDiv = document.getElementById('geojsonStatus');

  // Элементы для вкладки региона
  const regionSelect = document.getElementById('regionSelect');
  const processRegionButton = document.getElementById('processRegionButton');
  const regionResultDiv = document.getElementById('regionResult');
  const regionStatusDiv = document.getElementById('regionStatus');

  // Элементы для вкладки города
  const cityInput = document.getElementById('cityInput');
  const processCityButton = document.getElementById('processCityButton');
  const cityResultDiv = document.getElementById('cityResult');
  const cityStatusDiv = document.getElementById('cityStatus');

  // Управление вкладками
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  const copyButtons = document.querySelectorAll('.copy-btn');

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const tabId = this.getAttribute('data-tab');

      // Деактивируем все вкладки
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));

      // Активируем текущую вкладку
      this.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // Пример GeoJSON для вставки
  const exampleGeoJson = `{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "coordinates": [
          [
            [37.41932212390009, 55.87842920182371],
            [37.391955541904764, 55.81377086577942],
            [37.3754088395128, 55.72916741537614],
            [37.488628294592274, 55.62774113661476],
            [37.600302344700424, 55.57540258368866],
            [37.775940698009435, 55.615178063848674],
            [37.86038808042801, 55.68779586524562],
            [37.91766520947655, 55.75798423132929],
            [37.41932212390009, 55.87842920182371]
          ]
        ],
        "type": "Polygon"
      }
    }
  ]
}`;

  // Вставка примера GeoJSON
  document.getElementById('insertExample').addEventListener('click', function () {
    geojsonInput.value = exampleGeoJson;
  });

  // Обработка GeoJSON
  processGeojsonButton.addEventListener('click', async function () {
    await processGeoJSON(geojsonInput.value.trim(), geojsonResultDiv, geojsonStatusDiv, processGeojsonButton);
  });

  // Обработка региона
  processRegionButton.addEventListener('click', async function () {
    const region = regionSelect.value;
    if (!region) {
      showStatus(regionStatusDiv, 'Выберите регион', 'error');
      return;
    }

    await processRegion(region, regionResultDiv, regionStatusDiv, processRegionButton);
  });

  // Обработка города или региона
  processCityButton.addEventListener('click', async function () {
    const city = cityInput.value.trim();
    if (!city) {
      showStatus(cityStatusDiv, 'Введите название города или региона', 'error');
      return;
    }

    await processRegion(city, cityResultDiv, cityStatusDiv, processCityButton);
  });

  // Функция обработки GeoJSON
  async function processGeoJSON(geojsonText, resultDiv, statusDiv, button) {
    if (!geojsonText) {
      showStatus(statusDiv, 'Пожалуйста, введите GeoJSON', 'error');
      return;
    }

    try {
      const geoJson = JSON.parse(geojsonText);

      if (!geoJson.features || !geoJson.features[0] ||
        !geoJson.features[0].geometry ||
        geoJson.features[0].geometry.type !== 'Polygon' ||
        !geoJson.features[0].geometry.coordinates) {
        throw new Error('Неверный формат GeoJSON. Ожидается FeatureCollection с Polygon.');
      }

      showStatus(statusDiv, 'Обработка запроса...', 'loading');
      button.disabled = true;

      const coordinates = geoJson.features[0].geometry.coordinates[0];
      const overpassCoords = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(' ');

      const overpassQuery = `[out:json][timeout:30];(node["addr:postcode"](poly:"${overpassCoords}"););out center;`;

      const result = await fetchPostalCodes(encodeURIComponent(overpassQuery));

      displayResult(result, resultDiv, statusDiv, 'GeoJSON полигон');

    } catch (error) {
      console.error('Ошибка:', error);
      resultDiv.textContent = `Ошибка: ${error.message}`;
      showStatus(statusDiv, 'Произошла ошибка', 'error');
    } finally {
      button.disabled = false;
    }
  }

  // Функция обработки региона
  async function processRegion(regionName, resultDiv, statusDiv, button) {
    try {
      showStatus(statusDiv, `Поиск почтовых индексов в ${regionName}...`, 'loading');
      button.disabled = true;

      const overpassQuery = prepareQuery(regionName);
      const result = await fetchPostalCodes(encodeURIComponent(overpassQuery));

      displayResult(result, resultDiv, statusDiv, regionName);

    } catch (error) {
      console.error('Ошибка:', error);
      resultDiv.textContent = `Ошибка: ${error.message}`;
      showStatus(statusDiv, 'Произошла ошибка', 'error');
    } finally {
      button.disabled = false;
    }
  }

  // Обработка кнопок копирования
  copyButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const targetElement = document.getElementById(targetId);
      const textToCopy = targetElement.textContent;

      copyToClipboard(textToCopy, this);
    });
  });

  // Функция копирования в буфер обмена
  function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
      // Визуальная обратная связь
      const originalText = button.textContent;
      button.textContent = text?.length ? 'Скопировано!' : 'Нет данных';
      // console.log(originalText)
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);

    }).catch(err => {
      console.error('Ошибка при копировании: ', err);
      alert('Не удалось скопировать текст. Попробуйте выделить и скопировать вручную.');
    });
  }

  function prepareQuery(regionName){
    return `[out:json][timeout:45];area[name="${regionName}"]->.searchArea;(node["addr:postcode"](area.searchArea););out center;`;
  }

  async function fetchPostalCodes(query){
    const response = await fetch(`${SERVICE_REQUEST_URL}${query}`);

    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }

    const data = await response.json();
    console.log({query, data})
    return extractPostalCodes(data);
  }

  // Функция извлечения почтовых индексов
  function extractPostalCodes(data) {
    const result = new Set();
    for (const el of data.elements) {
      if (
        el?.tags
        && el.tags["addr:postcode"]
        && /^\d{6}$/.test(el.tags["addr:postcode"] )
      ) {
        result.add(el.tags["addr:postcode"]);
      }
    }
    return Array.from(result).sort();
  }

  // Функция отображения результата
  function displayResult(resultArray, resultDiv, statusDiv, sourceName) {
    if (resultArray.length > 0) {
      resultDiv.textContent = JSON.stringify({result: resultArray}, null, 2);
      showStatus(statusDiv, `Найдено ${resultArray.length} почтовых индексов в ${sourceName}`, 'success');
    } else {
      resultDiv.textContent = "Почтовые индексы не найдены";
      showStatus(statusDiv, 'Почтовые индексы не найдены', 'error');
    }
  }

  // Функция для отображения статуса
  function showStatus(statusDiv, message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status';
    if (type) {
      statusDiv.classList.add(type);
    }
  }
});