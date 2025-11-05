from fastapi import APIRouter

router = APIRouter()

# Route to get the list of available models for the simulation
@router.get("/models/")
async def get_models():
    models = ["LLAMA", "Falcon", "Mistral"]  # List of available models
    return {"available_models": models}

# Route to get the application name
@router.get("/app_name/")
async def get_app_name():
    return {"app_name": "Carbon Impact Simulation"}

