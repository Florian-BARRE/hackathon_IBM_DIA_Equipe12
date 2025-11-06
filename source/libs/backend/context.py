# ====== Standard Library Imports ======
from dataclasses import dataclass

# ====== Third-party Library Imports ======
from loggerplusplus import LoggerPlusPlus


# ====== Internal Project Imports ======
from .services.models import ModelParamsComputer


@dataclass(slots=True)
class CONTEXT:
    logger: LoggerPlusPlus
    model_params_computer: ModelParamsComputer
