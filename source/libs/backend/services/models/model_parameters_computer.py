import json
from loggerplusplus import LoggerClass
from pathlib import Path


class ModelParamsComputer(LoggerClass):
    def __init__(self, json_path: str | Path):
        LoggerClass.__init__(self)

        self.json_path = json_path
        self._load_json()

    def _load_json(self) -> None:
        """Charge le fichier JSON contenant les modèles et leurs paramètres."""
        try:
            with open(self.json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.models = data.get("available_models", data)
                self.logger.info(f"✅ Chargé {len(self.models)} modèles depuis {self.json_path}")
        except FileNotFoundError:
            self.logger.error(f"❌ Fichier introuvable : {self.json_path}")
        except json.JSONDecodeError as e:
            self.logger.error(f"❌ Erreur de parsing JSON : {e}")

    def get_models(self) -> list[str]:
        """Retourne la liste des modèles disponibles et log l’action."""
        if not self.models:
            self.logger.warning("⚠️ Aucun modèle chargé.")
            return []
        self.logger.debug(f"📋 Récupération de la liste des {len(self.models)} modèles.")
        return list(self.models.keys())

    def get_params(self, model_name: str) -> int | None:
        """Retourne le nombre de paramètres pour un modèle donné."""
        if not self.models:
            self.logger.warning("⚠️ Aucun modèle disponible, impossible de récupérer les paramètres.")
            return None

        params = self.models.get(model_name)
        if params is None:
            self.logger.warning(f"⚠️ Modèle '{model_name}' non trouvé dans la liste.")
        else:
            self.logger.debug(f"🔍 {model_name} → {params}B paramètres")
        return params
