const axios = require('axios');

/**
 * Weather forecast service (Development Prompt Section 6.4).
 * Uses OpenWeatherMap's One Call / 5-day forecast API when
 * OPENWEATHER_API_KEY is set; otherwise falls back to a deterministic
 * mock forecast generator so the weather-aware adjustment logic can be
 * developed and tested without an API key.
 */

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h || 1;
}

const CONDITIONS = [
  { summary: 'Clear', precipProb: 0.05 },
  { summary: 'Partly Cloudy', precipProb: 0.15 },
  { summary: 'Cloudy', precipProb: 0.3 },
  { summary: 'Light Rain', precipProb: 0.6 },
  { summary: 'Thunderstorms', precipProb: 0.85 },
];

/**
 * @param {{lat:number, lng:number, dates:string[]}} params dates as 'YYYY-MM-DD'
 * @returns {Promise<Array<{date, summary, temp_c, precip_probability}>>}
 */
async function getForecast({ lat, lng, dates }) {
  if (process.env.OPENWEATHER_API_KEY) {
    const resp = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
      params: { lat, lon: lng, appid: process.env.OPENWEATHER_API_KEY, units: 'metric' },
    });
    const byDate = {};
    (resp.data.list || []).forEach((entry) => {
      const date = entry.dt_txt.slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(entry);
    });
    return dates.map((date) => {
      const entries = byDate[date] || [];
      if (entries.length === 0) {
        return { date, summary: 'Unknown', temp_c: null, precip_probability: 0 };
      }
      const avgTemp = entries.reduce((s, e) => s + e.main.temp, 0) / entries.length;
      const maxPop = Math.max(...entries.map((e) => e.pop || 0));
      return {
        date,
        summary: entries[0].weather[0].main,
        temp_c: Math.round(avgTemp * 10) / 10,
        precip_probability: maxPop,
      };
    });
  }

  // --- Mock provider ---
  const rand = seededRandom(hashStr(`${lat.toFixed(2)},${lng.toFixed(2)}`));
  return dates.map((date) => {
    const cond = CONDITIONS[Math.floor(rand() * CONDITIONS.length)];
    const tempBase = 15 + rand() * 15; // 15-30C base
    return {
      date,
      summary: cond.summary,
      temp_c: Math.round(tempBase * 10) / 10,
      precip_probability: Math.round((cond.precipProb + (rand() - 0.5) * 0.2) * 100) / 100,
    };
  });
}

module.exports = { getForecast };
