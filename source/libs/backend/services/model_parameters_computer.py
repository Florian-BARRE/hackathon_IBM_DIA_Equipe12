import json
from pathlib import Path
from loggerplusplus import LoggerClass


class ModelParamsComputer(LoggerClass):
    def __init__(self, json_path: str | Path):
        super().__init__()
        self.json_path = json_path
        self.models = {}
        self._load_json()

    def _normalize_key(self, key: str) -> str:
        """Normalize model name or key for consistency."""
        return key.strip().lower().replace(" ", "").replace("-", "").replace("_", "")

    def _load_json(self) -> None:
        """Load the JSON file containing model names and their parameters."""
        try:
            with open(self.json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.raw_models = data.get("available_models", data)

                # Normalize keys for consistency
                self.models = {
                    self._normalize_key(k): v for k, v in self.raw_models.items()
                }

                self.logger.info(f"✅ Loaded {len(self.models)} models from {self.json_path}")
        except FileNotFoundError:
            self.logger.error(f"❌ File not found: {self.json_path}")
        except json.JSONDecodeError as e:
            self.logger.error(f"❌ JSON parsing error: {e}")

    def get_models(self) -> list[str]:
        """Return the list of available model names and log the action."""
        if not self.models:
            self.logger.warning("⚠️ No models loaded.")
            return []
        self.logger.debug(f"📋 Retrieved list of {len(self.models)} models.")
        return list(self.raw_models.keys())

    def get_params(self, model_name: str) -> int | None:
        """Return the number of parameters for a given model."""
        if not self.models:
            self.logger.warning("⚠️ No models available, cannot retrieve parameters.")
            return None

        normalized_name = self._normalize_key(model_name)
        params = self.models.get(normalized_name)

        if params is None:
            self.logger.warning(f"⚠️ Model '{model_name}' not found in the list.")
        else:
            self.logger.debug(f"🔍 {model_name} → {params}B parameters")

        return params
