import requests
from datetime import datetime, timezone
import urllib.parse
from loggerplusplus import LoggerClass


class ElectricityMapsAPI(LoggerClass):
    """Client simplifié pour l'API ElectricityMaps (intensité carbone actuelle)."""

    BASE_URL = "https://api.electricitymaps.com/v3/carbon-intensity/past"

    def __init__(self, token: str, use_utc: bool = True):
        """
        Args:
            token (str): Clé d'API ElectricityMaps.
            use_utc (bool): Si True, utilise l'heure UTC (par défaut).
        """
        LoggerClass.__init__(self)
        self.token = token
        self.use_utc = use_utc

    def _get_datetime_str(self) -> str:
        """Construit la date/heure au format attendu par l’API."""
        if self.use_utc:
            now = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            now = datetime.now()

        formatted = now.strftime("%Y-%m-%d+%H:%M")
        encoded = urllib.parse.quote(formatted, safe='+')
        self.logger.debug(f"🕒 Datetime pour API : {encoded}")
        return encoded

    def get_carbon_intensity(self, lat: float, lon: float) -> float | None:
        """
        Récupère l'intensité carbone (gCO₂/kWh) pour une localisation donnée.

        Args:
            lat (float): Latitude.
            lon (float): Longitude.

        Returns:
            float | None: L'intensité carbone en gCO₂/kWh ou None si erreur.
        """
        datetime_str = self._get_datetime_str()
        url = f"{self.BASE_URL}?datetime={datetime_str}&lat={lat}&lon={lon}"
        headers = {"auth-token": self.token}

        self.logger.info(f"🌍 Appel API : {url}")

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.RequestException as e:
            self.logger.error(f"❌ Erreur API : {e}")
            return None

        carbon_intensity = data.get("carbonIntensity")
        if carbon_intensity is None:
            self.logger.warning("⚠️ Pas de valeur 'carbonIntensity' dans la réponse API.")
            self.logger.debug(f"Réponse complète : {data}")
            return None

        self.logger.info(f"✅ Intensité carbone : {carbon_intensity} gCO₂/kWh")
        return carbon_intensity

    def estimate_impact(self, lat: float, lon: float, kwh: float) -> float | None:
        """
        Calcule l'impact carbone d'une consommation (en gCO₂).

        Args:
            lat (float): Latitude.
            lon (float): Longitude.
            kwh (float): Énergie consommée (en kWh).

        Returns:
            float | None: Émission estimée (en grammes de CO₂).
        """
        self.logger.debug(f"🔎 Calcul de l'impact carbone pour {kwh} kWh à {lat},{lon}")
        carbon_intensity = self.get_carbon_intensity(lat, lon)
        if carbon_intensity is None:
            self.logger.warning("⚠️ Impossible de calculer l'impact carbone : intensité non disponible.")
            return None

        total = carbon_intensity * kwh
        self.logger.info(f"💨 Impact estimé : {total:.2f} gCO₂ pour {kwh} kWh.")
        return total
