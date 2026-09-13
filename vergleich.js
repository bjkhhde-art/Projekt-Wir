const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CITIES = {
  hamburg: { name: "Hamburg", lat: 53.5511, lon: 9.9937, tz: "Europe/Berlin" },
  alicante: { name: "Alicante", lat: 38.3452, lon: -0.4810, tz: "Europe/Madrid" }
};

const WEATHER_CODES = {
  0: { icon: "☀️", label: "Klarer Himmel" },
  1: { icon: "🌤️", label: "Überwiegend klar" },
  2: { icon: "⛅", label: "Teilweise bewölkt" },
  3: { icon: "☁️", label: "Bedeckt" },
  45: { icon: "🌫️", label: "Nebel" },
  48: { icon: "🌫️", label: "Gefrierender Nebel" },
  51: { icon: "🌦️", label: "Leichter Nieselregen" },
  53: { icon: "🌦️", label: "Nieselregen" },
  55: { icon: "🌧️", label: "Starker Nieselregen" },
  56: { icon: "🌧️", label: "Gefrierender Nieselregen" },
  57: { icon: "🌧️", label: "Starker gefrierender Nieselregen" },
  61: { icon: "🌧️", label: "Leichter Regen" },
  63: { icon: "🌧️", label: "Regen" },
  65: { icon: "🌧️", label: "Starker Regen" },
  66: { icon: "🌧️", label: "Gefrierender Regen" },
  67: { icon: "🌧️", label: "Starker gefrierender Regen" },
  71: { icon: "🌨️", label: "Leichter Schneefall" },
  73: { icon: "🌨️", label: "Schneefall" },
  75: { icon: "❄️", label: "Starker Schneefall" },
  77: { icon: "🌨️", label: "Schneegriesel" },
  80: { icon: "🌦️", label: "Leichte Regenschauer" },
  81: { icon: "🌦️", label: "Regenschauer" },
  82: { icon: "⛈️", label: "Heftige Regenschauer" },
  85: { icon: "🌨️", label: "Leichte Schneeschauer" },
  86: { icon: "❄️", label: "Starke Schneeschauer" },
  95: { icon: "⛈️", label: "Gewitter" },
  96: { icon: "⛈️", label: "Gewitter mit Hagel" },
  99: { icon: "⛈️", label: "Gewitter mit starkem Hagel" }
};

const DAY_LABELS = ["Heute", "Morgen", "Übermorgen"];

function weatherInfo(code) {
  return WEATHER_CODES[code] || { icon: "🌡️", label: "Unbekannt" };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

document.getElementById("distanceValue").textContent =
  Math.round(haversineKm(CITIES.hamburg.lat, CITIES.hamburg.lon, CITIES.alicante.lat, CITIES.alicante.lon)).toLocaleString("de-DE") + " km";

/* ---------- weather ---------- */

async function fetchWeather(city) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=${encodeURIComponent(city.tz)}&forecast_days=3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Wetter-Request fehlgeschlagen: " + res.status);
  return res.json();
}

function computeWarnings(daily) {
  const warnings = [];
  const maxWind = Math.max(...daily.wind_speed_10m_max);
  const maxPrecip = Math.max(...daily.precipitation_probability_max);
  const maxTemp = Math.max(...daily.temperature_2m_max);
  const minTemp = Math.min(...daily.temperature_2m_min);

  if (maxWind >= 60) warnings.push({ icon: "💨", text: `Starker Wind bis ${Math.round(maxWind)} km/h` });
  if (maxPrecip >= 70) warnings.push({ icon: "🌧️", text: `Hohe Regenwahrscheinlichkeit (${maxPrecip}%)` });
  if (maxTemp >= 32) warnings.push({ icon: "🥵", text: `Hitze bis ${Math.round(maxTemp)}°C` });
  if (minTemp <= 0) warnings.push({ icon: "🥶", text: `Frost möglich (${Math.round(minTemp)}°C)` });

  return warnings;
}

function renderCity(key, data) {
  const iconEl = document.getElementById(`${key}Icon`);
  const tempEl = document.getElementById(`${key}Temp`);
  const conditionEl = document.getElementById(`${key}Condition`);
  const windEl = document.getElementById(`${key}Wind`);
  const humidityEl = document.getElementById(`${key}Humidity`);
  const forecastEl = document.getElementById(`${key}Forecast`);
  const warningsEl = document.getElementById(`${key}Warnings`);

  const current = data.current;
  const info = weatherInfo(current.weather_code);

  iconEl.textContent = info.icon;
  tempEl.textContent = Math.round(current.temperature_2m) + "°";
  conditionEl.textContent = info.label;
  windEl.textContent = `💨 ${Math.round(current.wind_speed_10m)} km/h`;
  humidityEl.textContent = `💧 ${Math.round(current.relative_humidity_2m)}%`;

  forecastEl.innerHTML = data.daily.time
    .map((time, i) => {
      const dayInfo = weatherInfo(data.daily.weather_code[i]);
      return `
        <div class="forecast-day">
          <p class="forecast-day-label">${DAY_LABELS[i] || new Date(time).toLocaleDateString("de-DE", { weekday: "short" })}</p>
          <span class="forecast-day-icon">${dayInfo.icon}</span>
          <p class="forecast-day-temps"><span class="max">${Math.round(data.daily.temperature_2m_max[i])}°</span> <span class="min">${Math.round(data.daily.temperature_2m_min[i])}°</span></p>
        </div>
      `;
    })
    .join("");

  const warnings = computeWarnings(data.daily);
  warningsEl.innerHTML = warnings
    .map(w => `<div class="city-warning">${w.icon} ${w.text}</div>`)
    .join("");
}

async function loadCityWeather(key) {
  try {
    const data = await fetchWeather(CITIES[key]);
    renderCity(key, data);
  } catch (error) {
    console.error(`Fehler beim Laden des Wetters für ${key}:`, error);
    document.getElementById(`${key}Condition`).textContent = "Wetter konnte nicht geladen werden.";
  }
}

/* ---------- news ---------- */

function renderNewsList(container, items) {
  if (!items || items.length === 0) {
    container.innerHTML = `<p class="news-empty">Keine Schlagzeilen verfügbar.</p>`;
    return;
  }

  container.innerHTML = items
    .map(item => `<a class="news-item" href="${item.link}" target="_blank" rel="noopener">${item.title}</a>`)
    .join("");
}

async function loadNews() {
  const newsDe = document.getElementById("newsDe");
  const newsEs = document.getElementById("newsEs");

  const { data, error } = await supabaseClient.functions.invoke("city-news", { body: {} });

  if (error) {
    console.error("Fehler beim Laden der Nachrichten:", error);
    newsDe.innerHTML = `<p class="news-empty">Nachrichten konnten nicht geladen werden.</p>`;
    newsEs.innerHTML = `<p class="news-empty">Nachrichten konnten nicht geladen werden.</p>`;
    return;
  }

  renderNewsList(newsDe, data.de);
  renderNewsList(newsEs, data.es);
}

/* ---------- init ---------- */

loadCityWeather("hamburg");
loadCityWeather("alicante");
loadNews();
