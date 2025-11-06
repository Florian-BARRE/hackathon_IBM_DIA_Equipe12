# ====== Standard Library Imports ======


# ====== Third-party Library Imports ======
from fastapi import APIRouter
import numpy as np

# ====== Internal Project Imports ======
from ...utils.error_handling import auto_handle_errors
from ...context import CONTEXT
from .model import UserInput, EnterpriseInput

# ====== Router Definition ======
router = APIRouter()


@auto_handle_errors
# Route to handle simulation of carbon impact
@router.post("/simulate_carbon_impact/")
async def simulate_carbon_impact(user_input: UserInput):
    # Compute all needed metrics for inference
    parameters = CONTEXT.model_params_computer.get_params(user_input.model)
    lat, lon = map(float, user_input.location.split(", "))
    prompt_indicators = CONTEXT.prompt_computer.compute(user_input.prompt)

    # Infer energy consumption (in Wh)
    energy_kwh = CONTEXT.watsonx_api.predict(
        have_gpu=user_input.has_gpu,
        device=user_input.device_type,
        nb_parameters=parameters,
        indicators=prompt_indicators
    )

    energy_wh = energy_kwh * 1000

    # Calculate carbon impact (in gCO2)
    carbon_gco2 = CONTEXT.electricity_maps_api.estimate_impact(
        lat=lat, lon=lon,
        kwh=energy_kwh
    )

    # Calculate equivalent metrics
    # Smartphone battery: ~15 Wh average capacity
    phone_charges = energy_wh / 15

    # LED bulb: ~10W, so hours of usage
    led_hours = energy_wh / 10

    # Laptop charge: ~50 Wh average
    laptop_charges = energy_wh / 50

    # km driven by average car (120g CO2/km)
    km_car = carbon_gco2 / 120

    # Trees needed to offset (1 tree absorbs ~21kg CO2/year)
    trees_year = carbon_gco2 / 21000

    result = {
        "energy_kwh": round(energy_kwh, 6),
        "carbon_gco2": round(carbon_gco2, 3),
        "equivalents": {
            "phone_charges": round(phone_charges, 2),
            "led_hours": round(led_hours, 2),
            "laptop_charges": round(laptop_charges, 2),
            "km_car": round(km_car, 3),
            "trees_year": round(trees_year, 4)
        }
    }
    return result


@auto_handle_errors
@router.post("/simulate_enterprise_impact/")
async def simulate_enterprise_impact(enterprise_input: EnterpriseInput):
    """
    Simulate carbon impact for enterprise usage over a year
    """
    # First, calculate impact for a single query
    parameters = CONTEXT.model_params_computer.get_params(enterprise_input.model)
    lat, lon = map(float, enterprise_input.location.split(", "))
    prompt_indicators = CONTEXT.prompt_computer.compute(enterprise_input.prompt)

    # Single query energy (in Wh)
    energy_kwh = CONTEXT.watsonx_api.predict(
        have_gpu=enterprise_input.has_gpu,
        device=enterprise_input.device_type,
        nb_parameters=parameters,
        indicators=prompt_indicators
    )

    carbon_gco2 = CONTEXT.electricity_maps_api.estimate_impact(
        lat=lat, lon=lon,
        kwh=energy_kwh
    )

    # Calculate yearly totals
    daily_queries = enterprise_input.queries_per_user_per_day
    employees = enterprise_input.number_of_employees
    working_days = 250  # Average working days per year

    total_queries_year = daily_queries * employees * working_days
    total_energy_kwh = energy_kwh * total_queries_year
    total_carbon_kg = (carbon_gco2 * total_queries_year) / 1000
    total_carbon_tons = total_carbon_kg / 1000
    
    # Monthly breakdown with low-dispersion seasonal simulation
    monthly_data = []
    # Smooth seasonality (lower in Aug/Dec, higher in spring/autumn)
    weights = np.array([0.92, 0.96, 1.00, 1.04, 1.08, 1.10, 0.98, 0.88, 1.04, 1.06, 1.00, 0.94], dtype=float)
    weights = weights / weights.sum()  # normalize to 1

    # Expected queries per month based on seasonality
    expected = total_queries_year * weights

    # Small multiplicative noise for realism (low dispersion)
    noise = np.clip(np.random.normal(1.0, 0.03, 12), 0.90, 1.10)  # ~3% stdev, capped +/-10%
    noisy = expected * noise

    # Renormalize so the total stays equal to total_queries_year
    noisy *= (total_queries_year / noisy.sum())

    # Round to integers while preserving the total
    rounded = np.floor(noisy).astype(int)
    remainder = int(total_queries_year - rounded.sum())
    fractional_order = np.argsort(noisy - rounded)[::-1]
    for i in range(abs(remainder)):
        idx = fractional_order[i % 12]
        rounded[idx] += 1 if remainder > 0 else -1
        if rounded[idx] < 0:
            rounded[idx] = 0

    for month in range(1, 13):
        q = int(rounded[month - 1])
        monthly_energy = energy_kwh * q
        monthly_carbon = (carbon_gco2 * q) / 1000.0
        monthly_data.append({
            "month": month,
            "queries": q,
            "energy_kwh": round(monthly_energy, 2),
            "carbon_kg": round(monthly_carbon, 2)
        })
    # Calculate equivalents for yearly total

    trees_needed = total_carbon_kg / 21  # 1 tree absorbs 21kg CO2/year
    km_car = (total_carbon_kg * 1000) / 120  # 120g CO2/km
    transatlantic_flights = total_carbon_tons / 1.5  # ~1.5 tons CO2 per transatlantic flight

    result = {
        "single_query": {
            "energy_kwh": round(energy_kwh, 6),
            "carbon_gco2": round(carbon_gco2, 3)
        },
        "yearly_totals": {
            "total_queries": int(total_queries_year),
            "total_energy_kwh": round(total_energy_kwh, 2),
            "total_carbon_kg": round(total_carbon_kg, 2),
            "total_carbon_tons": round(total_carbon_tons, 3)
        },
        "monthly_breakdown": monthly_data,
        "equivalents": {
            "trees_needed": round(trees_needed, 1),
            "km_car": round(km_car, 1),
            "transatlantic_flights": round(transatlantic_flights, 2),
            "paris_newyork_flights": round(transatlantic_flights, 2)
        },
        "per_employee": {
            "queries_per_year": int(daily_queries * working_days),
            "energy_kwh": round((total_energy_kwh / employees), 2),
            "carbon_kg": round((total_carbon_kg / employees), 2)
        }
    }

    return result