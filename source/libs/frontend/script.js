// Global state
let appData = {
    appName: 'EcoLLM Tracker',
    models: [],
    deviceType: '',
    location: ''
};

let monthlyChart = null;
let breakdownChart = null;
let yearlyMetricsChart = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize app data
async function initializeApp() {
    // Fetch app name
    try {
        const response = await fetch('/infos/app_name/');
        const data = await response.json();
        appData.appName = data.app_name;
        document.getElementById('appName').textContent = data.app_name;
    } catch (error) {
        console.log('Using default app name');
    }

    // Fetch available models
    try {
        const response = await fetch('/infos/models/');
        const data = await response.json();
        appData.models = data.available_models;
        populateModelSelect('model', data.available_models);
        populateModelSelect('enterpriseModel', data.available_models);
    } catch (error) {
        console.log('Using default models');
        const defaultModels = ['LLaMA-3-70B', 'Gemma-7B', 'CodeLLaMA-34B', 'Falcon-40B', 'Mistral-7B'];
        appData.models = defaultModels;
        populateModelSelect('model', defaultModels);
        populateModelSelect('enterpriseModel', defaultModels);
    }

    // Detect device type
    appData.deviceType = getDeviceType();
    document.getElementById('deviceType').textContent = appData.deviceType;

    // Get location
    getLocation();
}

// Populate model select dropdown
function populateModelSelect(selectId, models) {
    const modelSelect = document.getElementById(selectId);
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
    });
}

// Get device type
function getDeviceType() {
    const userAgent = navigator.userAgent;
    if (/mobile/i.test(userAgent)) {
        return 'Mobile';
    } else if (/tablet/i.test(userAgent)) {
        return 'Tablet';
    } else {
        return 'Desktop';
    }
}

// Get user location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude.toFixed(2);
                const lon = position.coords.longitude.toFixed(2);
                appData.location = `${lat}, ${lon}`;
                document.getElementById('location').textContent = appData.location;
            },
            (error) => {
                // Default to Paris if geolocation fails
                appData.location = '48.85, 2.35';
                document.getElementById('location').textContent = 'Paris, FR';
            }
        );
    } else {
        appData.location = '48.85, 2.35';
        document.getElementById('location').textContent = 'Paris, FR';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.getElementById('tabPersonal').addEventListener('click', () => switchTab('personal'));
    document.getElementById('tabEnterprise').addEventListener('click', () => switchTab('enterprise'));

    // Simulation buttons
    document.getElementById('simulateBtn').addEventListener('click', handlePersonalSimulation);
    document.getElementById('simulateEnterpriseBtn').addEventListener('click', handleEnterpriseSimulation);
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

// Handle personal simulation
async function handlePersonalSimulation() {
    const prompt = document.getElementById('prompt').value;
    const model = document.getElementById('model').value;
    const hasGpu = document.getElementById('hasGpu').checked;

    // Validation
    if (!prompt || !model) {
        showError('Veuillez remplir tous les champs requis');
        return;
    }

    // Clear error
    hideError();

    // Show loading state
    setLoadingState(true, 'simulateBtn', 'btnText', 'btnIcon');

    // Prepare request data
    const requestData = {
        prompt: prompt,
        model: model,
        device_type: appData.deviceType,
        location: appData.location,
        has_gpu: hasGpu
    };

    try {
        // Call backend API
        const response = await fetch('/computation/simulate_carbon_impact/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la simulation');
        }

        const data = await response.json();
        displayPersonalResults(data, model);
    } catch (error) {
        console.error('Error:', error);
        showError('Erreur lors de la simulation. Veuillez réessayer.');
    } finally {
        setLoadingState(false, 'simulateBtn', 'btnText', 'btnIcon');
    }
}

// Display personal results
function displayPersonalResults(data, model) {
    // Hide empty state
    document.getElementById('emptyState').classList.add('hidden');

    // Show results card
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.classList.remove('hidden');

    // Update model name
    document.getElementById('resultModel').textContent = model;

    // Update main metrics
    document.getElementById('carbonImpact').textContent = data.carbon_gco2 || '0';
    document.getElementById('energyConsumption').textContent = data.energy_kwh || '0';

    // Update equivalents
    if (data.equivalents) {
        document.getElementById('phoneCharges').textContent = data.equivalents.phone_charges || '0';
        document.getElementById('laptopCharges').textContent = data.equivalents.laptop_charges || '0';
        document.getElementById('ledHours').textContent = data.equivalents.led_hours || '0';
        document.getElementById('kmCar').textContent = data.equivalents.km_car || '0';
        document.getElementById('treesYear').textContent = data.equivalents.trees_year || '0';
    }

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Handle enterprise simulation
async function handleEnterpriseSimulation() {
    const prompt = document.getElementById('enterprisePrompt').value;
    const model = document.getElementById('enterpriseModel').value;
    const hasGpu = document.getElementById('enterpriseGpu').checked;
    const queriesPerDay = parseInt(document.getElementById('queriesPerDay').value);
    const numEmployees = parseInt(document.getElementById('numEmployees').value);

    // Validation
    if (!prompt || !model) {
        showEnterpriseError('Veuillez remplir tous les champs requis');
        return;
    }

    if (queriesPerDay < 1 || numEmployees < 1) {
        showEnterpriseError('Les valeurs doivent être supérieures à 0');
        return;
    }

    // Clear error
    hideEnterpriseError();

    // Show loading state
    setLoadingState(true, 'simulateEnterpriseBtn', 'enterpriseBtnText');

    // Prepare request data
    const requestData = {
        prompt: prompt,
        model: model,
        device_type: appData.deviceType,
        location: appData.location,
        has_gpu: hasGpu,
        queries_per_user_per_day: queriesPerDay,
        number_of_employees: numEmployees
    };

    try {
        // Call backend API
        const response = await fetch('/computation/simulate_enterprise_impact/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la simulation entreprise');
        }

        const data = await response.json();
        displayEnterpriseResults(data);
    } catch (error) {
        console.error('Error:', error);
        showEnterpriseError('Erreur lors de la simulation. Veuillez réessayer.');
    } finally {
        setLoadingState(false, 'simulateEnterpriseBtn', 'enterpriseBtnText');
    }
}

// Display enterprise results
function displayEnterpriseResults(data) {
    // Show results container
    const resultsContainer = document.getElementById('enterpriseResults');
    resultsContainer.classList.remove('hidden');

    // Update summary cards
    document.getElementById('totalQueries').textContent = formatNumber(data.yearly_totals.total_queries);
    document.getElementById('totalEnergy').textContent = formatNumber(data.yearly_totals.total_energy_kwh);
    document.getElementById('totalCarbon').textContent = data.yearly_totals.total_carbon_tons;
    document.getElementById('totalTrees').textContent = data.equivalents.trees_needed;

    // Update equivalents
    document.getElementById('flightsEquiv').textContent = data.equivalents.paris_newyork_flights;
    document.getElementById('kmCarEquiv').textContent = formatNumber(data.equivalents.km_car);
    document.getElementById('treesEquiv').textContent = data.equivalents.trees_needed;

    // Update per employee stats
    document.getElementById('perEmpQueries').textContent = formatNumber(data.per_employee.queries_per_year);
    document.getElementById('perEmpEnergy').textContent = data.per_employee.energy_kwh;
    document.getElementById('perEmpCarbon').textContent = data.per_employee.carbon_kg;

    // Create chart
    createYearlyMetricsChart(data.monthly_breakdown);
// Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Create monthly evolution chart
function createMonthlyChart(monthlyData) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');

    // Destroy existing chart if it exists
    if (monthlyChart) {
        monthlyChart.destroy();
    }

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const carbonData = monthlyData.map(m => m.carbon_kg);
    const energyData = monthlyData.map(m => m.energy_kwh);

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'CO₂ (kg)',
                    data: carbonData,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Énergie (kWh)',
                    data: energyData,
                    borderColor: 'rgb(234, 179, 8)',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'CO₂ (kg)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Énergie (kWh)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

// Create a single yearly metrics chart (CO2, Energy, Queries over 12 months)
function createYearlyMetricsChart(monthlyData) {
    const ctx = document.getElementById('yearlyMetricsChart').getContext('2d');

    // Destroy existing chart if it exists
    if (yearlyMetricsChart) {
        yearlyMetricsChart.destroy();
    }

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const carbonData = monthlyData.map(m => m.carbon_kg);
    const energyData = monthlyData.map(m => m.energy_kwh);
    const queriesData = monthlyData.map(m => m.queries);

    yearlyMetricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'CO₂ (kg)',
                    data: carbonData,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.35,
                    fill: true,
                    yAxisID: 'yCarbon'
                },
                {
                    label: 'Énergie (kWh)',
                    data: energyData,
                    borderColor: 'rgb(234, 179, 8)',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    tension: 0.35,
                    fill: true,
                    yAxisID: 'yEnergy'
                },
                {
                    label: 'Requêtes (mois)',
                    data: queriesData,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderDash: [6, 6],
                    pointRadius: 2,
                    tension: 0.25,
                    fill: false,
                    yAxisID: 'yQueries'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            // Use thousands separators for readability
                            return label + ': ' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                        }
                    }
                }
            },
            scales: {
                yCarbon: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'CO₂ (kg)' }
                },
                yEnergy: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Énergie (kWh)' }
                },
                yQueries: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Requêtes' }
                }
            }
        }
    });
}


// Create breakdown chart (doughnut)
function createBreakdownChart(yearlyData) {
    const ctx = document.getElementById('breakdownChart').getContext('2d');

    // Destroy existing chart if it exists
    if (breakdownChart) {
        breakdownChart.destroy();
    }

    breakdownChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Énergie (kWh)', 'CO₂ (kg)'],
            datasets: [{
                data: [
                    yearlyData.total_energy_kwh,
                    yearlyData.total_carbon_kg
                ],
                backgroundColor: [
                    'rgba(234, 179, 8, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgb(234, 179, 8)',
                    'rgb(239, 68, 68)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatNumber(context.parsed);
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.classList.add('hidden');
}

// Show enterprise error message
function showEnterpriseError(message) {
    const errorMessage = document.getElementById('enterpriseError');
    const errorText = document.getElementById('enterpriseErrorText');
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide enterprise error message
function hideEnterpriseError() {
    const errorMessage = document.getElementById('enterpriseError');
    errorMessage.classList.add('hidden');
}

// Set loading state
function setLoadingState(isLoading, btnId, textId, iconId = null) {
    const button = document.getElementById(btnId);
    const btnText = document.getElementById(textId);

    if (isLoading) {
        button.disabled = true;
        btnText.textContent = 'Calcul en cours...';

        // Hide icon if provided
        if (iconId) {
            const icon = document.getElementById(iconId);
            if (icon) icon.style.display = 'none';
        }

        // Add spinner
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.id = 'loadingSpinner';
        button.insertBefore(spinner, btnText);
    } else {
        button.disabled = false;

        // Remove spinner
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.remove();
        }

        // Restore icon if provided
        if (iconId) {
            const icon = document.getElementById(iconId);
            if (icon) icon.style.display = 'block';
        }

        // Restore button text based on which button
        if (btnId === 'simulateBtn') {
            btnText.textContent = 'Simuler l\'Impact';
        } else if (btnId === 'simulateEnterpriseBtn') {
            btnText.textContent = 'Calculer l\'Impact Annuel';
        }
    }
}

// Format number with spaces for thousands
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}