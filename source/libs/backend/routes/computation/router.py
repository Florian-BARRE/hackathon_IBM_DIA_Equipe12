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
@router.post("/simulate_carbon_impact/")
async def simulate_carbon_impact(user_input: UserInput):
    """
    Simulate carbon impact for a single user query (personal usage).
    Returns energy (kWh), carbon (gCO2) and adapted equivalents:
    - phone_charges (15 Wh / charge)
    - laptop_charges (50 Wh / charge)
    - led_hours (10 W bulb -> Wh/10)
    """
    # Compute model parameters & prompt indicators
    parameters = CONTEXT.model_params_computer.get_params(user_input.model)
    lat, lon = map(float, user_input.location.split(", "))
    prompt_indicators = CONTEXT.prompt_computer.compute(user_input.prompt)

    # Predict energy (kWh) and carbon (gCO2)
    energy_kwh = CONTEXT.watsonx_api.predict(
        have_gpu=user_input.has_gpu,
        device=user_input.device_type,
        nb_parameters=parameters,
        indicators=prompt_indicators
    )
    energy_wh = energy_kwh * 1000.0

    carbon_gco2 = CONTEXT.electricity_maps_api.estimate_impact(
        lat=lat, lon=lon, kwh=energy_kwh
    )

    # Equivalents (personal)
    phone_charges = energy_wh / 15.0  # ~15 Wh per phone full charge
    km_car = (carbon_gco2 / 120.0)        # 120 g CO2 per km
    led_hours = energy_wh / 10.0  # 10 W LED -> Wh/10 = hours

    result = {
        "energy_kwh": round(energy_kwh, 6),
        "carbon_gco2": round(carbon_gco2, 3),
        "equivalents": {
            "phone_charges": round(phone_charges, 2),
            "led_hours": round(led_hours, 2),
            "km_car": round(km_car, 5)
        }
    }
    return result


@auto_handle_errors
@router.post("/simulate_enterprise_impact/")
async def simulate_enterprise_impact(enterprise_input: EnterpriseInput):
    """
    Simulate carbon impact for enterprise usage over a year.

    Returns:
    - single_query: energy_kwh, carbon_gco2
    - yearly_totals: total_queries, total_energy_kwh, total_carbon_kg, total_carbon_tons
    - monthly_breakdown: list of { month, queries, energy_kwh, carbon_kg }
    - equivalents (adapted for low emissions): phone_charges, km_car, led_hours, trees_needed
    - per_employee: queries_per_year, energy_kwh, carbon_kg
    """
    # Single query computation context
    parameters = CONTEXT.model_params_computer.get_params(enterprise_input.model)
    lat, lon = map(float, enterprise_input.location.split(", "))
    prompt_indicators = CONTEXT.prompt_computer.compute(enterprise_input.prompt)

    # Predict single-query energy (kWh) and carbon (gCO2)
    energy_kwh = CONTEXT.watsonx_api.predict(
        have_gpu=enterprise_input.has_gpu,
        device=enterprise_input.device_type,
        nb_parameters=parameters,
        indicators=prompt_indicators
    )

    carbon_gco2 = CONTEXT.electricity_maps_api.estimate_impact(
        lat=lat, lon=lon, kwh=energy_kwh
    )

    # Yearly totals
    daily_queries = enterprise_input.queries_per_user_per_day
    employees = enterprise_input.number_of_employees
    working_days = 250  # average working days per year

    total_queries_year = int(daily_queries * employees * working_days)
    total_energy_kwh = energy_kwh * total_queries_year
    total_carbon_kg = (carbon_gco2 * total_queries_year) / 1000.0
    total_carbon_tons = total_carbon_kg / 1000.0

    # Monthly breakdown with smooth, low-dispersion seasonality
    monthly_data = []
    weights = np.array([0.92, 0.96, 1.00, 1.04, 1.08, 1.10, 0.98, 0.88, 1.04, 1.06, 1.00, 0.94], dtype=float)
    weights = weights / weights.sum()

    expected = total_queries_year * weights
    noise = np.clip(np.random.normal(1.0, 0.03, 12), 0.90, 1.10)
    noisy = expected * noise
    noisy *= (total_queries_year / noisy.sum())

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
        monthly_carbon = (carbon_gco2 * q) / 1000.0  # kg
        monthly_data.append({
            "month": month,
            "queries": q,
            "energy_kwh": round(monthly_energy, 2),
            "carbon_kg": round(monthly_carbon, 2)
        })

    # Equivalents (enterprise, low-impact oriented)
    energy_wh_total = total_energy_kwh * 1000.0
    phone_charges_eq = energy_wh_total / 15.0  # 15 Wh per phone charge
    led_hours_eq = energy_wh_total / 10.0  # 10 W LED -> Wh/10
    km_car_eq = (total_carbon_kg * 1000.0) / 120.0  # 120 g CO2 / km
    trees_needed = total_carbon_kg / 21.0  # 21 kg CO2 absorbed per tree/year

    result = {
        "single_query": {
            "energy_kwh": round(energy_kwh, 6),
            "carbon_gco2": round(carbon_gco2, 3)
        },
        "yearly_totals": {
            "total_queries": total_queries_year,
            "total_energy_kwh": round(total_energy_kwh, 2),
            "total_carbon_kg": round(total_carbon_kg, 2),
            "total_carbon_tons": round(total_carbon_tons, 3)
        },
        "monthly_breakdown": monthly_data,
        "equivalents": {
            "phone_charges": round(phone_charges_eq, 0),
            "km_car": round(km_car_eq, 1),
            "led_hours": round(led_hours_eq, 0),
            "trees_needed": round(trees_needed, 1)
        },
        "per_employee": {
            "queries_per_year": int(daily_queries * working_days),
            "energy_kwh": round((total_energy_kwh / employees), 2),
            "carbon_kg": round((total_carbon_kg / employees), 2)
        }
    }

    return result
