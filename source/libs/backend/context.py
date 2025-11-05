# ====== Standard Library Imports ======
from dataclasses import dataclass

# ====== Third-party Library Imports ======
from loggerplusplus import LoggerPlusPlus


# ====== Internal Project Imports ======


@dataclass(slots=True)
class CONTEXT:
    logger: LoggerPlusPlus
