# EcoLLM Tracker — Carbon Impact Simulator

**One‑line pitch:** *Instantly estimate and visualize the energy use and CO₂ impact of your AI prompts — for individuals and at company scale — with live, location‑aware electricity data and a sleek, zero‑install web UI.*

---

## Why this matters

Large Language Models (LLMs) consume energy. The impact varies with **model size**, **device & GPU usage**, and **where** you run the workload (electricity carbon intensity is not the same in France, Germany, or the US). Today, most teams have no easy way to **estimate** and **communicate** the footprint of everyday AI usage.

**EcoLLM Tracker** fixes that in minutes: type a prompt, pick a model/device, drop a pin on the map, and get **energy (kWh), CO₂ (g)** and **everyday equivalents** (phone charges, LED hours, km by car). Switch to **Enterprise Mode** to project the annual footprint for your whole organization, broken down per month and per employee.

---

## Key features

- **Personal Simulation**
  - Type your **prompt** and select a **model** (e.g., *Llama3‑70B, Claude 3.5 Sonnet, GPT‑4 Turbo, Mistral Large*, …).
  - Pick your **device** (Desktop / Laptop / Server) and **GPU usage**.
  - Set your **location** via a **Leaflet** map (reverse‑geocoded to country).
  - Get **instant results**: energy (in Wh), CO₂ (in g), and fun equivalences:
    - 📱 *Phone charges*
    - 💡 *LED bulb hours*
    - 🚗 *Kilometers by car*
- **Enterprise Simulation**
  - Enter **employees** and **queries per user per day**.
  - Get **yearly totals**, a **month‑by‑month breakdown**, per‑employee metrics, and adapted equivalents (*phone charges, LED hours, km car, trees needed*).
  - Auto‑renders a **Chart.js** line chart for carbon over the year.
- **Location‑aware CO₂**
  - Uses **ElectricityMaps** carbon intensity data (by lat/lon) to adapt emissions to your location.
- **IBM watsonx powered**
  - We call an **IBM watsonx** deployment that predicts energy & CO₂ from:
    - Model parameter count
    - Device type & GPU
    - Prompt “complexity” indicators (word count, average lengths, punctuation markers, etc.).
- **Beautiful UX**
  - **TailwindCSS** UI, real‑time feedback, animated states, and a clean information hierarchy.
  - **No build step needed** — just run the FastAPI app and open the page.

---

## How it works (Architecture)

```
FastAPI (Python)
├─ /computation
│  ├─ POST /simulate_carbon_impact        # personal run
│  └─ POST /simulate_enterprise_impact    # company-scale run
├─ /infos
│  ├─ GET  /models                        # available LLMs (and param counts)
│  └─ GET  /app_name
├─ /health
│  └─ GET  /ping
└─ Static front-end (index.html + script.js served at "/")
```

### Data flow
1. **Frontend** (Vanilla JS + Tailwind + Chart.js + Leaflet)
   - Detects/lets you set **device**, **GPU**, **location**, **model**, **prompt**.
   - Calls the backend `/computation` routes.
2. **Backend** (FastAPI)
   - Converts the **prompt** into features via `PromptComputer` (word & sentence stats, punctuation markers, etc.).
   - Looks up the **model parameters** from `source/data/models.json` via `ModelParamsComputer`.
   - Queries **ElectricityMaps** to fetch the **current carbon intensity** for the chosen coordinates.
   - Calls **IBM watsonx** (`WatsonClient`) with the above factors to **predict energy (kWh)** and **CO₂ (g)**.
   - Returns friendly **equivalents** and (in Enterprise mode) a **monthly breakdown** and **per‑employee** metrics.
3. **Frontend** renders numbers & charts, plus the equivalences.

---

## Tech stack

- **Backend:** FastAPI, Pydantic, Uvicorn, Requests, Python 3.12
- **Frontend:** HTML, TailwindCSS (CDN), Chart.js (CDN), Leaflet (CDN)
- **ML & Data:** IBM watsonx (inference endpoint), ElectricityMaps API
- **Utilities:** `loggerplusplus`, `python-dotenv`
- **Data:** `source/data/models.json` (model → parameter count mapping)

---

## Project structure

```
hackathon_IBM_DIA_Equipe12/
├─ source/
│  ├─ entrypoint.py                 # FastAPI app factory + static mount
│  ├─ requirements.txt
│  ├─ config_loader.py              # ENV loading + paths (frontend dir, tokens, etc.)
│  ├─ data/
│  │  └─ models.json                # Available LLMs with parameter counts
│  └─ libs/
│     ├─ backend/
│     │  ├─ app.py, context.py, lifespan.py
│     │  ├─ routes/
│     │  │  ├─ computation/         # POST simulate endpoints (+ pydantic models)
│     │  │  ├─ infos/               # models + app_name
│     │  │  └─ health/              # ping
│     │  ├─ services/
│     │  │  ├─ prompt_computer.py   # prompt feature engineering
│     │  │  ├─ model_parameters_computer.py
│     │  │  ├─ electricitymaps_client.py
│     │  │  └─ watsonx_client.py
│     │  └─ utils/error_handling.py
│     └─ frontend/
│        ├─ index.html              # single‑page app (Tailwind, Chart.js, Leaflet)
│        └─ script.js               # all UI logic + API calls
├─ demo_video.mp4                   # quick demo (optional asset)
└─ pitchdeck.pdf                    # hackathon slides (optional asset)
```

> **Note:** The frontend is served directly from the folder configured by `FRONTEND_DIR` in the environment; in this repo it’s `source/libs/frontend`.

---

## Startup (Docker)

This app ships with a Docker setup for a zero-install run.

### Prerequisites

* Docker & Docker Compose installed
* A `.env` file in `source/` (see the keys listed earlier)

### Commands (from `source/`)

**Build images**

```bash
docker compose --env-file ./.env -f docker-compose.yml build
```

**Run (production-like)**

```bash
docker compose --env-file ./.env -f docker-compose.yml up -d
```

**Run (development, with live reload)**

```bash
docker compose --env-file ./.env -f docker-compose.yml -f docker-compose.dev.yml up
```

* The API/UI is exposed on **[http://localhost:8000](http://localhost:8000)** (port mapping `8000:8000`).
* Container name: `hackathon_app`.

### Useful maintenance

**View logs**

```bash
docker compose -f docker-compose.yml logs -f
```

**Stop & remove containers**

```bash
docker compose -f docker-compose.yml down
```

**Rebuild after changes**

```bash
docker compose --env-file ./.env -f docker-compose.yml build --no-cache
```

## What makes this different

- **End‑to‑end**: from prompt → features → energy/CO₂ → human‑readable equivalents & charts.
- **Live, location‑aware CO₂**: adjusts emissions to the country you select on the map.
- **Enterprise mode**: instantly scales up to your real usage patterns.
- **Simple deploy**: no bundler/build; single FastAPI app serving the SPA.
- **Extensible**:
  - Add models & parameter counts in `source/data/models.json`.
  - Swap the carbon data provider (currently ElectricityMaps).
  - Replace/upgrade the IBM watsonx deployment without touching the UI.


---

## Demo & Pitch

- `demo_video.mp4` — short walkthrough of the app.
- `pitchdeck.pdf` — the hackathon slide deck.

---

## Team

*IBM Hackathon, Team 12*  

- Loic BEAURAIN
- Florian BARRE 
- Rachid AIT AMEUR 
- Léo GASPEROWICZ 
- Noé Bourdin 
- Pierre Louis 

