from fastapi import APIRouter

from ...context import CONTEXT
from ...utils.error_handling import auto_handle_errors

router = APIRouter()

# Route to get the list of available models for the simulation
@auto_handle_errors
@router.get("/models/")
async def get_models():
    return {
        "available_models": CONTEXT.model_params_computer.get_models()
    }

# Route to get the application name
@auto_handle_errors
@router.get("/app_name/")
async def get_app_name():
    return {"app_name": "EcoLLM - Carbon Impact Simulation"}

