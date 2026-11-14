// ===== البيانات =====
let trips = [];
try { trips = JSON.parse(localStorage.getItem("trips")) || []; } catch { trips = []; }
let selectedId = null;

function save() { localStorage.setItem("trips", JSON.stringify(trips)); }
function getSelected() { return trips.find((t) => t.id === selectedId); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ===== عناصر الصفحة =====
const tripForm = document.getElementById("tripForm");
const tripName = document.getElementById("tripName");
const tripDest = document.getElementById("tripDest");
const tripsList = document.getElementById("tripsList");
const tripView = document.getElementById("tripView");
const budgetEl = document.getElementById("budget");
const daysEl = document.getElementById("days");
const addDayBtn = document.getElementById("addDayBtn");
const deleteTripBtn = document.getElementById("deleteTripBtn");
const weatherEl = document.getElementById("weather");
const themeBtn = document.getElementById("themeBtn");

// ===== الوضع الداكن =====
function applyTheme() {
  const dark = localStorage.getItem("theme") === "dark";
  document.body.classList.toggle("dark", dark);
  themeBtn.textContent = dark ? "☀️" : "🌙";
}

themeBtn.onclick = () => {
  const dark = !document.body.classList.contains("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  applyTheme();
  const t = getSelected();
  if (t) renderChart(t);
};

// ===== الطقس =====
function weatherIcon(code) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

async function loadWeather(destination) {
  if (!destination) { weatherEl.innerHTML = ""; return; }
  weatherEl.innerHTML = '<span class="weather-msg">جاري تحميل الطقس...</span>';
  try {
    const geoRes = await fetch(
      "https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(destination) + "&count=1"
    );
    const geo = await geoRes.json();
    if (!geo.results || !geo.results.length) {
      weatherEl.innerHTML = '<span class="weather-msg">ما لقينا الوجهة، جرّب كتابتها بالإنجليزي.</span>';
      return;
    }
    const { latitude, longitude } = geo.results[0];
    const wRes = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=" + latitude + "&longitude=" + longitude +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5"
    );
    const w = await wRes.json();

    weatherEl.innerHTML = w.daily.time.map((date, i) => {
      const dayName = new Date(date).toLocaleDateString("ar", { weekday: "short" });
      return '<div class="weather-day">' +
        "<div>" + dayName + "</div>" +
        '<div class="icon">' + weatherIcon(w.daily.weather_code[i]) + "</div>" +
        "<div>" + Math.round(w.daily.temperature_2m_max[i]) + "° / " + Math.round(w.daily.temperature_2m_min[i]) + "°</div>" +
        "</div>";
    }).join("");
  } catch {
    weatherEl.innerHTML = '<span class="weather-msg">تعذّر تحميل الطقس، تأكد من الإنترنت.</span>';
  }
}

// ===== الرسم البياني =====
let expenseChart = null;

function renderChart(trip) {
  const box = document.getElementById("chartBox");

  if (typeof Chart === "undefined") { box.hidden = true; return; }

  const totals = trip.days.map((d) => d.activities.reduce((s, a) => s + a.cost, 0));
  const hasData = totals.some((t) => t > 0);
  box.hidden = !hasData;

  if (expenseChart) { expenseChart.destroy(); expenseChart = null; }
  if (!hasData) return;

  const dark = document.body.classList.contains("dark");
  const textColor = dark ? "#e6f0f3" : "#12303b";
  const gridColor = dark ? "#264250" : "#cfdde3";
  const barColor = dark ? "#2bb3c9" : "#0f7c8f";

  expenseChart = new Chart(document.getElementById("expenseChart"), {
    type: "bar",
    data: {
      labels: trip.days.map((_, i) => "اليوم " + (i + 1)),
      datasets: [{
        label: "المصاريف ($)",
        data: totals,
        backgroundColor: barColor,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
      },
    },
  });
}

// ===== العرض =====
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function render() {
  tripsList.innerHTML = "";
  if (!trips.length) {
    tripsList.innerHTML = '<span class="empty">ما عندك رحلات بعد. أنشئ أول رحلة من الأعلى.</span>';
  }

  trips.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = t.name + (t.destination ? " · " + t.destination : "");
    if (t.id === selectedId) btn.classList.add("active");
    btn.onclick = () => {
      selectedId = t.id;
      render();
      loadWeather(t.destination);
    };
    tripsList.appendChild(btn);
  });

  const trip = getSelected();
  if (!trip) { tripView.hidden = true; return; }
  tripView.hidden = false;

  let total = 0;
  trip.days.forEach((d) => d.activities.forEach((a) => (total += a.cost)));
  budgetEl.textContent = total;
  renderChart(trip);

  daysEl.innerHTML = "";
  trip.days.forEach((day, i) => {
    const dayTotal = day.activities.reduce((s, a) => s + a.cost, 0);

    const card = document.createElement("div");
    card.className = "day";
    card.innerHTML =
      '<div class="day-header">' +
        '<span class="name">اليوم ' + (i + 1) + "</span>" +
        '<span class="sum">' + dayTotal + "$</span>" +
        '<button type="button" class="del delDay" title="حذف اليوم">🗑</button>' +
      "</div>" +
      "<ul>" +
        day.activities.map((a) =>
          "<li>" +
            '<div class="info"><span>' + escapeHtml(a.title) + "</span><span>" + a.cost + "$</span></div>" +
            '<button type="button" class="del delAct" data-id="' + a.id + '" title="حذف">✕</button>' +
          "</li>"
        ).join("") +
      "</ul>" +
      "<form>" +
        '<input placeholder="نشاط" />' +
        '<input placeholder="التكلفة" type="number" min="0" />' +
        "<button>+</button>" +
      "</form>";

    card.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const inputs = e.target.querySelectorAll("input");
      const title = inputs[0].value.trim();
      const cost = Number(inputs[1].value) || 0;
      if (!title) return;
      day.activities.push({ id: uid(), title, cost });
      save();
      render();
    };

    card.querySelectorAll(".delAct").forEach((btn) => {
      btn.onclick = () => {
        day.activities = day.activities.filter((a) => a.id !== btn.dataset.id);
        save();
        render();
      };
    });

    card.querySelector(".delDay").onclick = () => {
      trip.days = trip.days.filter((d) => d.id !== day.id);
      save();
      render();
    };

    daysEl.appendChild(card);
  });
}

// ===== الأحداث =====
tripForm.onsubmit = (e) => {
  e.preventDefault();
  if (!tripName.value.trim()) return;
  const trip = {
    id: uid(),
    name: tripName.value.trim(),
    destination: tripDest.value.trim(),
    days: [],
  };
  trips.push(trip);
  selectedId = trip.id;
  tripName.value = "";
  tripDest.value = "";
  save();
  render();
  loadWeather(trip.destination);
};

addDayBtn.onclick = () => {
  getSelected().days.push({ id: uid(), activities: [] });
  save();
  render();
};

deleteTripBtn.onclick = () => {
  if (!confirm("متأكد بدك تحذف الرحلة؟")) return;
  trips = trips.filter((t) => t.id !== selectedId);
  selectedId = null;
  weatherEl.innerHTML = "";
  save();
  render();
};

applyTheme();
render();
