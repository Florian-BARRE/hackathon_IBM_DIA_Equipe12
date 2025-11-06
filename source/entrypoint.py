# ====== Standard Library Imports ======

# ====== Third-Party Library Imports ======
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loggerplusplus import LoggerPlusPlus, loggerplusplus
from starlette.types import ASGIApp
from fastapi import FastAPI
from typing import cast

# ====== Internal Project Imports ======
from config_loader import CONFIG

# Background & api context
from backend.app import create_app
from backend.context import CONTEXT

# Services
from backend.services.models import ModelParamsComputer

# =======================
#   Private Functions
# =======================

# =======================
#   Application Factory
# =======================

def _build_app() -> FastAPI:
    """
    Assemble and return a fully configured FastAPI application.

    Returns:
        FastAPI: The application object to be served by Uvicorn.
    """

    # Create app context -> inject shared instance to the global shared context
    CONTEXT.logger = LoggerPlusPlus(
        core=loggerplusplus.bind(identifier="main")
    )
    CONTEXT.model_params_computer = ModelParamsComputer(
        json_path=CONFIG.MODELS_PATH
    )

    # Create the FastAPI application
    fastapi_app = create_app()

    # Mount the static front-end at the root URL
    fastapi_app.mount(
        "/",  # URL root
        StaticFiles(directory=CONFIG.FRONTEND_DIR, html=True),
        name="static",
    )

    # CORS for the hub at http://localhost:{CONFIG.AGGREGATOR_UI_PORT}
    fastapi_app.add_middleware(
        cast(type[ASGIApp], CORSMiddleware),
        allow_origins=[f"http://localhost:{CONFIG.PORT}"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return fastapi_app


# =======================
#   Application Export
# =======================
app: FastAPI = _build_app()

__all__ = ["app"]
