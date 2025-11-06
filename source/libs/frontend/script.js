// Global state
let appData = {
  appName: 'EcoLLM Tracker',
  models: [],
  deviceType: '',        // "Desktop" | "Laptop" | "Server"
  location: '',
  deviceConfidence: 0,   // 0..1
  userAgent: ''
};

let yearlyMetricsChart = null;

// Map picker state
let mapInstance = null;
let mapMarker = null;
let mapInitialized = false;
let pendingLat = null;
let pendingLon = null;

document.addEventListener('DOMContentLoaded', function () {
  initializeApp();
  setupEventListeners();
});

async function initializeApp() {
  // App name
  try {
    const r = await fetch('/infos/app_name/');
    const d = await r.json();
    appData.appName = d.app_name;
    document.getElementById('appName').textContent = d.app_name;
  } catch {}

  // Models
  try {
    const r = await fetch('/infos/models/');
    const d = await r.json();
    appData.models = d.available_models;
    populateModelSelect('model', d.available_models);
    populateModelSelect('enterpriseModel', d.available_models);
  } catch {
    const defaults = ['LLaMA-3-70B', 'Gemma-7B', 'CodeLLaMA-34B', 'Falcon-40B', 'Mistral-7B'];
    appData.models = defaults;
    populateModelSelect('model', defaults);
    populateModelSelect('enterpriseModel', defaults);
  }

  // Best-match device (NOT hardcoded Desktop)
  appData.userAgent = navigator.userAgent || '';
  const { best, confidence } = detectBestDevice();
  appData.deviceType = best;
  appData.deviceConfidence = confidence;

  // Paint UI for device chip + menu with best match
  document.getElementById('deviceType').textContent = appData.deviceType;
  document.getElementById('bestMatchLabel').textContent = appData.deviceType;
  document.getElementById('bestMatchConfidence').textContent = `~${Math.round(confidence * 100)}%`;
  document.getElementById('uaBlock').textContent = appData.userAgent;

  // Set icon right away
  updateDeviceIcon(appData.deviceType);

  // Geolocate (can be overridden by picker)
  getLocation();
}

function populateModelSelect(selectId, models) {
  const el = document.getElementById(selectId);
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    el.appendChild(opt);
  });
}

// Heuristic device classifier
function detectBestDevice() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const w = window.screen?.width || 0;
  const h = window.screen?.height || 0;

  const serverHints = /(headless|curl|wget|httpclient|postman|bot|crawler|spider)/i.test(ua);
  if (serverHints) return { best: 'Server', confidence: 0.9 };

  const isMobile = /mobile|android|iphone|ipod/.test(ua);
  const isTablet = /ipad|tablet/.test(ua);
  if (isMobile || isTablet) return { best: 'Laptop', confidence: 0.55 };

  const desktopOS = /(macintosh|mac os x|windows nt|x11|linux)/.test(ua);
  if (desktopOS) {
    if ((h && h <= 900) || (w && w <= 1600)) return { best: 'Laptop', confidence: 0.65 };
    return { best: 'Desktop', confidence: 0.7 };
  }
  return { best: 'Desktop', confidence: 0.5 };
}

// Location — initial detection (overridable)
function getLocation() {
  const el = document.getElementById('location');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(2);
        const lon = pos.coords.longitude.toFixed(2);
        appData.location = `${lat}, ${lon}`;
        el.textContent = `${lat}, ${lon}`;
      },
      () => {
        appData.location = '48.85, 2.35';
        el.textContent = '48.85, 2.35';
      }
    );
  } else {
    appData.location = '48.85, 2.35';
    el.textContent = '48.85, 2.35';
  }
}

function setupEventListeners() {
  // Tabs
  document.getElementById('tabPersonal').addEventListener('click', () => switchTab('personal'));
  document.getElementById('tabEnterprise').addEventListener('click', () => switchTab('enterprise'));

  // Simulations
  document.getElementById('simulateBtn').addEventListener('click', handlePersonalSimulation);
  document.getElementById('simulateEnterpriseBtn').addEventListener('click', handleEnterpriseSimulation);

  // Device switcher open/close
  const switcherBtn = document.getElementById('deviceSwitcherBtn');
  const deviceMenu = document.getElementById('deviceMenu');
  switcherBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deviceMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!deviceMenu.classList.contains('hidden')) {
      const inside = deviceMenu.contains(e.target) || switcherBtn.contains(e.target);
      if (!inside) deviceMenu.classList.add('hidden');
    }
  });

  // Device option clicks
  document.querySelectorAll('.device-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.getAttribute('data-device');
      setDeviceType(selected);
      deviceMenu.classList.add('hidden');
    });
  });

  // Location picker
  document.getElementById('locationChip').addEventListener('click', openLocationPicker);
  document.getElementById('closeMapBtn').addEventListener('click', closeLocationPicker);
  document.getElementById('cancelMapBtn').addEventListener('click', closeLocationPicker);
  document.getElementById('saveMapBtn').addEventListener('click', savePickedLocation);
}

// Map device -> emoji and set it on the main button icon span
function updateDeviceIcon(type) {
  const iconMap = {
    'Desktop': '🖥️',
    'Laptop': '💻',
    'Server': '🗄️'
  };
  const icon = document.getElementById('deviceIcon');
  if (icon) icon.textContent = iconMap[type] || '💻';
}

// Apply device choice
function setDeviceType(type) {
  appData.deviceType = type;
  document.getElementById('deviceType').textContent = type;
  document.getElementById('bestMatchLabel').textContent = type;
  document.getElementById('bestMatchConfidence').textContent = 'manual';
  updateDeviceIcon(type);
}

// Switch between tabs
function switchTab(tab) {
  const tabs = ['Personal', 'Enterprise'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab${t}`);
    const section = document.getElementById(`${t.toLowerCase()}Section`);
    if (t.toLowerCase() === tab) {
      btn.classList.add('active');
      btn.classList.remove('text-gray-600');
      section.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      btn.classList.add('text-gray-600');
      section.classList.add('hidden');
    }
  });
}

// --- Personal Simulation ---
async function handlePersonalSimulation() {
  const prompt = document.getElementById('prompt').value;
  const model = document.getElementById('model').value;
  const hasGpu = document.getElementById('hasGpu').checked;

  if (!prompt || !model) {
    showError('Please fill out all required fields');
    return;
  }
  hideError();
  setLoadingState(true, 'simulateBtn', 'btnText', 'btnIcon');

  const requestData = {
    prompt,
    model,
    device_type: appData.deviceType,
    device_meta: { user_agent: appData.userAgent, confidence: appData.deviceConfidence },
    location: appData.location,
    has_gpu: hasGpu
  };

  try {
    const r = await fetch('/computation/simulate_carbon_impact/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestData)
    });
    if (!r.ok) throw new Error('Simulation error');
    const d = await r.json();
    displayPersonalResults(d, model);
  } catch (e) {
    console.error(e);
    showError('Error during simulation. Please try again.');
  } finally {
    setLoadingState(false, 'simulateBtn', 'btnText', 'btnIcon');
  }
}

function displayPersonalResults(data, model) {
  document.getElementById('emptyState').classList.add('hidden');
  const resultsContainer = document.getElementById('resultsContainer');
  resultsContainer.classList.remove('hidden');

  document.getElementById('resultModel').textContent = model;

  // Personal: show energy in Wh (kWh * 1000)
  const energyWh = (data.energy_kwh || 0) * 1000;
  document.getElementById('energyConsumption').textContent = formatNumber(energyWh);

  document.getElementById('carbonImpact').textContent = data.carbon_gco2 || '0';

  if (data.equivalents) {
    document.getElementById('phoneCharges').textContent = data.equivalents.phone_charges ?? '0';
    document.getElementById('ledHours').textContent = data.equivalents.led_hours ?? '0';
  }

  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- Enterprise Simulation ---
async function handleEnterpriseSimulation() {
  const prompt = document.getElementById('enterprisePrompt').value;
  const model = document.getElementById('enterpriseModel').value;
  const hasGpu = document.getElementById('enterpriseGpu').checked;
  const queriesPerDay = parseInt(document.getElementById('queriesPerDay').value);
  const numEmployees = parseInt(document.getElementById('numEmployees').value);

  if (!prompt || !model) { showEnterpriseError('Please fill out all required fields'); return; }
  if (queriesPerDay < 1 || numEmployees < 1) { showEnterpriseError('Values must be greater than 0'); return; }
  hideEnterpriseError();
  setLoadingState(true, 'simulateEnterpriseBtn', 'enterpriseBtnText');

  const requestData = {
    prompt,
    model,
    device_type: appData.deviceType,
    device_meta: { user_agent: appData.userAgent, confidence: appData.deviceConfidence },
    location: appData.location,
    has_gpu: hasGpu,
    queries_per_user_per_day: queriesPerDay,
    number_of_employees: numEmployees
  };

  try {
    const r = await fetch('/computation/simulate_enterprise_impact/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestData)
    });
    if (!r.ok) throw new Error('Enterprise simulation error');
    const d = await r.json();
    displayEnterpriseResults(d);
  } catch (e) {
    console.error(e);
    showEnterpriseError('Error during simulation. Please try again.');
  } finally {
    setLoadingState(false, 'simulateEnterpriseBtn', 'enterpriseBtnText');
  }
}

function displayEnterpriseResults(data) {
  const resultsContainer = document.getElementById('enterpriseResults');
  resultsContainer.classList.remove('hidden');

  // Top cards (Trees card removed)
  document.getElementById('totalQueries').textContent = formatNumber(data.yearly_totals.total_queries);
  document.getElementById('totalEnergy').textContent = formatNumber(data.yearly_totals.total_energy_kwh);
  const co2kg = (data.yearly_totals.total_carbon_kg != null)
    ? data.yearly_totals.total_carbon_kg
    : (data.yearly_totals.total_carbon_tons || 0) * 1000;
  document.getElementById('totalCarbon').textContent = formatNumber(co2kg);

  // Equivalents (low impact)
  if (data.equivalents) {
    document.getElementById('phoneChargesEquiv').textContent = formatNumber(data.equivalents.phone_charges ?? 0);
    document.getElementById('kmCarEquiv').textContent = formatNumber(data.equivalents.km_car ?? 0);
    document.getElementById('ledHoursEquiv').textContent = formatNumber(data.equivalents.led_hours ?? 0);
  }

  // Per employee
  document.getElementById('perEmpQueries').textContent = formatNumber(data.per_employee.queries_per_year);
  document.getElementById('perEmpEnergy').textContent = data.per_employee.energy_kwh;
  document.getElementById('perEmpCarbon').textContent = data.per_employee.carbon_kg;

  createYearlyMetricsChart(data.monthly_breakdown);
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createYearlyMetricsChart(monthlyData) {
  const ctx = document.getElementById('yearlyMetricsChart').getContext('2d');
  if (yearlyMetricsChart) yearlyMetricsChart.destroy();

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const carbonData = monthlyData.map(m => m.carbon_kg);
  const energyData = monthlyData.map(m => m.energy_kwh);
  const queriesData = monthlyData.map(m => m.queries);

  yearlyMetricsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'CO₂ (kg)', data: carbonData, borderColor: 'rgb(239, 68, 68)', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.35, fill: true, yAxisID: 'yCarbon' },
        { label: 'Energy (kWh)', data: energyData, borderColor: 'rgb(234, 179, 8)', backgroundColor: 'rgba(234, 179, 8, 0.1)', tension: 0.35, fill: true, yAxisID: 'yEnergy' },
        { label: 'Queries (month)', data: queriesData, borderColor: 'rgb(16, 185, 129)', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderDash: [6, 6], pointRadius: 2, tension: 0.25, fill: false, yAxisID: 'yQueries' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { callbacks: { label: (ctx) => (ctx.dataset.label || '') + ': ' + formatNumber(ctx.parsed.y) } }
      },
      scales: {
        yCarbon: { type: 'linear', position: 'left', title: { display: true, text: 'CO₂ (kg)' } },
        yEnergy: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Energy (kWh)' } },
        yQueries: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Queries' } }
      }
    }
  });
}

// ---- Location picker (Leaflet) ----
function openLocationPicker() {
  const modal = document.getElementById('mapModal');
  modal.classList.remove('hidden');

  // Parse current location (fallback Paris)
  let lat = 48.85, lon = 2.35;
  try {
    const [la, lo] = (appData.location || '48.85, 2.35').split(',').map(v => parseFloat(v.trim()));
    if (!Number.isNaN(la) && !Number.isNaN(lo)) { lat = la; lon = lo; }
  } catch {}

  pendingLat = lat;
  pendingLon = lon;
  document.getElementById('pickedCoords').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  // Initialize Leaflet only once
  setTimeout(() => {
    if (!mapInitialized) {
      mapInstance = L.map('worldMap', { worldCopyJump: true, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(mapInstance);

      mapMarker = L.marker([lat, lon], { draggable: true }).addTo(mapInstance);

      mapMarker.on('dragend', (e) => {
        const { lat: la, lng: lo } = e.target.getLatLng();
        pendingLat = la; pendingLon = lo;
        document.getElementById('pickedCoords').textContent = `${la.toFixed(4)}, ${lo.toFixed(4)}`;
      });

      mapInstance.on('click', (e) => {
        const { lat: la, lng: lo } = e.latlng;
        pendingLat = la; pendingLon = lo;
        mapMarker.setLatLng([la, lo]);
        document.getElementById('pickedCoords').textContent = `${la.toFixed(4)}, ${lo.toFixed(4)}`;
      });

      mapInitialized = true;
    }

    // Reset view/marker every time we open
    mapInstance.setView([lat, lon], 3);
    mapMarker.setLatLng([lat, lon]);
  }, 0);
}

function closeLocationPicker() {
  document.getElementById('mapModal').classList.add('hidden');
}

function savePickedLocation() {
  if (pendingLat == null || pendingLon == null) return;
  appData.location = `${pendingLat.toFixed(2)}, ${pendingLon.toFixed(2)}`;
  document.getElementById('location').textContent = appData.location;
  closeLocationPicker();
}

// ---- UI utils ----
function showError(message) {
  const el = document.getElementById('errorMessage');
  document.getElementById('errorText').textContent = message;
  el.classList.remove('hidden');
}
function hideError() { document.getElementById('errorMessage').classList.add('hidden'); }

function showEnterpriseError(message) {
  const el = document.getElementById('enterpriseError');
  document.getElementById('enterpriseErrorText').textContent = message;
  el.classList.remove('hidden');
}
function hideEnterpriseError() { document.getElementById('enterpriseError').classList.add('hidden'); }

function setLoadingState(isLoading, btnId, textId, iconId = null) {
  const button = document.getElementById(btnId);
  const btnText = document.getElementById(textId);
  if (isLoading) {
    button.disabled = true;
    btnText.textContent = 'Calculating...';
    if (iconId) {
      const icon = document.getElementById(iconId);
      if (icon) icon.style.display = 'none';
    }
    const spinner = document.createElement('div');
    spinner.className = 'spinner'; spinner.id = 'loadingSpinner';
    button.insertBefore(spinner, btnText);
  } else {
    button.disabled = false;
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();
    if (iconId) {
      const icon = document.getElementById(iconId);
      if (icon) icon.style.display = 'block';
    }
    if (btnId === 'simulateBtn') btnText.textContent = 'Run Simulation';
    else if (btnId === 'simulateEnterpriseBtn') btnText.textContent = 'Compute Annual Impact';
  }
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  const n = typeof num === 'number' ? num : Number(num);
  if (Number.isNaN(n)) return String(num);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
