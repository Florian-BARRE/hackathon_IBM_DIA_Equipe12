// Global state
let appData = {
    appName: 'EcoLLM Tracker',
    models: [],
    deviceType: '',
    location: ''
};

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
        populateModelSelect(data.available_models);
    } catch (error) {
        console.log('Using default models');
        const defaultModels = ['LLaMA-3-70B', 'Gemma-7B', 'CodeLLaMA-34B', 'Falcon-40B', 'Mistral-7B'];
        appData.models = defaultModels;
        populateModelSelect(defaultModels);
    }

    // Detect device type
    appData.deviceType = getDeviceType();
    document.getElementById('deviceType').textContent = appData.deviceType;

    // Get location
    getLocation();
}

// Populate model select dropdown
function populateModelSelect(models) {
    const modelSelect = document.getElementById('model');

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
                appData.location = 'Paris, FR';
                document.getElementById('location').textContent = appData.location;
            }
        );
    } else {
        appData.location = 'Non disponible';
        document.getElementById('location').textContent = appData.location;
    }
}

// Setup event listeners
function setupEventListeners() {
    const simulateBtn = document.getElementById('simulateBtn');
    simulateBtn.addEventListener('click', handleSimulation);
}

// Handle simulation
async function handleSimulation() {
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
    setLoadingState(true);

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
        displayResults(data, model);
    } catch (error) {
        console.error('Error:', error);

        // Generate mock data for demo
        const baseImpact = Math.random() * 30 + 20;
        const gpuReduction = hasGpu ? 0.7 : 1;

        const mockData = {
            carbonImpact: (baseImpact * gpuReduction).toFixed(2),
            energyConsumption: (Math.random() * 100 + 50).toFixed(2),
            tokensProcessed: Math.floor(prompt.length * 1.3 + Math.random() * 200),
            inferenceTime: (Math.random() * 2 + 0.5).toFixed(2),
            treesEquivalent: ((baseImpact * gpuReduction) / 100).toFixed(3)
        };

        displayResults(mockData, model);
    } finally {
        setLoadingState(false);
    }
}

// Display results
function displayResults(data, model) {
    // Hide empty state
    document.getElementById('emptyState').classList.add('hidden');

    // Show results card
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.classList.remove('hidden');

    // Update model name
    document.getElementById('resultModel').textContent = model;

    // Update metrics
    document.getElementById('carbonImpact').textContent = data.carbonImpact || data.carbon_impact || '0';
    document.getElementById('energyConsumption').textContent = data.energyConsumption || data.energy_consumption || '0';
    document.getElementById('tokensProcessed').textContent = data.tokensProcessed || data.tokens_processed || '0';
    document.getElementById('inferenceTime').textContent = data.inferenceTime || data.inference_time || '0';
    document.getElementById('treesEquivalent').textContent = data.treesEquivalent || data.trees_equivalent || '0';

    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

// Set loading state
function setLoadingState(isLoading) {
    const simulateBtn = document.getElementById('simulateBtn');
    const btnText = document.getElementById('btnText');

    if (isLoading) {
        simulateBtn.disabled = true;
        btnText.textContent = 'Calcul en cours...';

        // Replace icon with spinner
        const svg = simulateBtn.querySelector('svg');
        if (svg) {
            svg.style.display = 'none';
        }

        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.id = 'loadingSpinner';
        simulateBtn.insertBefore(spinner, btnText);
    } else {
        simulateBtn.disabled = false;
        btnText.textContent = 'Simuler l\'Impact Carbone';

        // Remove spinner and show icon
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.remove();
        }

        const svg = simulateBtn.querySelector('svg');
        if (svg) {
            svg.style.display = 'block';
        }
    }
}