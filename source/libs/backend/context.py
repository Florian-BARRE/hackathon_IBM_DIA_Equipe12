# ====== Standard Library Imports ======
from dataclasses import dataclass

# ====== Third-party Library Imports ======
from loggerplusplus import LoggerPlusPlus

# ====== Internal Project Imports ======
from .services.model_parameters_computer import ModelParamsComputer
from .services.electricitymaps_client import ElectricityMapsAPI
from .services.prompt_computer import PromptComputer
from .services.watsonx_client import WatsonClient


@dataclass(slots=True)
class CONTEXT:
    logger: LoggerPlusPlus
    model_params_computer: ModelParamsComputer
    electricity_maps_api: ElectricityMapsAPI
    prompt_computer: PromptComputer
    watsonx_api: WatsonClient
