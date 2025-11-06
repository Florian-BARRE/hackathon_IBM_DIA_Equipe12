# ====== Code Summary ======
# IBM Watson Machine Learning v4 client for prediction and authentication.
# Inherits logging capabilities from LoggerClass and supports detailed logging
# for all key operations, including token management and prediction requests.

# ====== Standard Library Imports ======
import time
import json
import logging

# ====== Third-Party Library Imports ======
import requests
from requests import Response

# ====== Internal Project Imports ======
# (None)

# ====== Local Project Imports ======
from typing import TYPE_CHECKING, Any, Union, Optional
from loggerplusplus import LoggerClass

class WatsonClient(LoggerClass):
    """
    Minimal IBM Cloud WML v4 client with a high-level predict() method.

    Example usage:
        client = WatsonClient(
            api_key="YOUR_IBM_CLOUD_API_KEY",
            region="us-south",
            deployment_id="fa6a06ba-98f2-475c-87e1-47f09974c4d4",
            version="2021-05-01",
        )

        indicators = {
            "word_count": 10,
            "avg_word_length": 10,
            "avg_sentence_length": 12,
            "avg_sentence_length_cubed": 44,
            "question_marks": 55,
            "exclamation_marks": 55,
        }

        result = client.predict(device="desktop", nb_parameters=7, indicators=indicators)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    """

    IAM_URL: str = "https://iam.cloud.ibm.com/identity/token"

    def __init__(
        self,
        api_key: str,
        region: str,
        deployment_id: str,
        version: str = "2021-05-01",
        use_private: bool = False,
        connect_timeout: float = 8.0,
        read_timeout: float = 60.0,
        max_retries: int = 1,
    ) -> None:
        super().__init__()

        if not api_key or api_key.lower().startswith("cpd-"):
            raise ValueError("Provide a valid IBM Cloud API key (not a CPD key).")

        self.api_key = api_key
        self.region = region
        self.deployment_id = deployment_id
        self.version = version
        self.use_private = use_private
        self.timeout = (connect_timeout, read_timeout)
        self.max_retries = max_retries

        host = (
            f"private.{region}.ml.cloud.ibm.com"
            if use_private
            else f"{region}.ml.cloud.ibm.com"
        )
        self.base_predict_url: str = (
            f"https://{host}/ml/v4/deployments/{deployment_id}/predictions?version={version}"
        )

        self._token: Optional[str] = None
        self._token_obtained_at: float = 0.0
        self._token_ttl_sec: int = 50 * 60  # refresh after 50 min

        self.logger.info("WatsonClient initialized for region=%s deployment_id=%s", region, deployment_id)

    # =============================
    # Public API
    # =============================

    def predict(
        self,
        have_gpu: bool,
        device: str,
        nb_parameters: str | int | float,
        indicators: dict[str, Any],
        headers: Optional[dict[str, str]] = None,
    ) -> float:
        """
        High-level scoring helper.
        Automatically constructs the payload for your model.

        Args:
            device: e.g. "desktop"
            nb_parameters: can be str/int/float (model should handle it)
            indicators: dict of the other fields and values (same keys as model training)
            headers: optional dict of extra headers (merged with auth headers)

        Returns:
            float: Model prediction result
        """
        self.logger.debug("Calling predict with device=%s nb_parameters=%s", device, nb_parameters)

        # 1. Validate indicators
        if not isinstance(indicators, dict) or not indicators:
            raise ValueError("indicators must be a non-empty dict")

        # 2. Build input structure
        fields = ["usable_gpu", "device", "nb_parameters"] + list(indicators.keys())
        values = [[have_gpu, device, nb_parameters] + list(indicators.values())]
        payload: dict[str, Any] = {"input_data": [{"fields": fields, "values": values}]}

        self.logger.info("Submitting prediction request with fields: %s", fields)

        # 3. Submit and return prediction
        return self._send_prediction(payload, headers)["predictions"][0]["values"][0][0]

    def predict_raw(
        self,
        payload: dict[str, Any],
        headers: Optional[dict[str, str]] = None
    ) -> dict[str, Any]:
        """
        Submit a fully-constructed payload manually (low-level interface).

        Args:
            payload: Complete input payload.
            headers: Optional headers to include.

        Returns:
            dict: Response from the model.
        """
        self.logger.debug("Calling predict_raw with custom payload.")
        return self._send_prediction(payload, headers)

    # =============================
    # Internals
    # =============================

    def _send_prediction(
        self,
        payload: dict[str, Any],
        headers: Optional[dict[str, str]] = None
    ) -> dict[str, Any]:
        """
        Handles sending the prediction request with retries and auth management.
        """
        self._ensure_token_fresh()
        final_headers = self._auth_headers()
        if headers:
            final_headers.update(headers)

        for attempt in range(self.max_retries + 1):
            self.logger.debug("Attempt %d to send prediction", attempt + 1)
            resp = self._post_json(self.base_predict_url, payload, final_headers)

            if resp.status_code == 401 and attempt == 0:
                self.logger.warning("Unauthorized request. Refreshing token.")
                self._refresh_token(force=True)
                final_headers = self._auth_headers()
                resp = self._post_json(self.base_predict_url, payload, final_headers)

            if 200 <= resp.status_code < 300:
                self.logger.info("Prediction request successful.")
                return self._json_or_text(resp)

            if resp.status_code == 403:
                self.logger.error("Access forbidden (403). Check IAM permissions.")
                hint = (
                    "Forbidden (403): Your identity is not a member of the deployment space.\n"
                    "- In Deployment Space → Manage → Access control: add your IBMid or Service ID (role: Editor).\n"
                )
                raise WatsonMLClientError(resp.status_code, self._json_or_text(resp), hint)

            if 500 <= resp.status_code < 600 and attempt < self.max_retries:
                self.logger.warning("Server error %d. Retrying...", resp.status_code)
                time.sleep(1.5 * (attempt + 1))
                continue

            self.logger.error("Prediction request failed with status %d", resp.status_code)
            raise WatsonMLClientError(resp.status_code, self._json_or_text(resp))

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _json_or_text(self, resp: Response) -> dict[str, Any] | str:
        try:
            return resp.json()
        except ValueError:
            self.logger.warning("Response was not JSON. Returning raw text.")
            return resp.text

    def _post_json(self, url: str, payload: dict[str, Any], headers: dict[str, str]) -> Response:
        try:
            self.logger.debug("Posting JSON to URL: %s", url)
            return requests.post(url, json=payload, headers=headers, timeout=self.timeout)
        except requests.exceptions.ConnectTimeout as e:
            self.logger.error("Connection timeout: %s", e)
            raise WatsonMLNetworkError(f"Timeout when connecting to {url}: {e}")
        except requests.RequestException as e:
            self.logger.error("Request failed: %s", e)
            raise WatsonMLNetworkError(str(e))

    def _ensure_token_fresh(self) -> None:
        now = time.time()
        if not self._token or (now - self._token_obtained_at) > self._token_ttl_sec:
            self.logger.info("Refreshing IAM token...")
            self._refresh_token(force=True)

    def _refresh_token(self, force: bool = False) -> None:
        if self._token and not force:
            return

        data = {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": self.api_key,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        r = requests.post(self.IAM_URL, data=data, headers=headers, timeout=self.timeout)

        if r.status_code != 200:
            self.logger.error("Failed to refresh token. Status: %d", r.status_code)
            raise WatsonMLAuthError(f"IAM token error ({r.status_code}). {r.text}")

        tok = r.json().get("access_token")
        if not tok:
            self.logger.error("No access_token found in IAM response.")
            raise WatsonMLAuthError(f"IAM response missing access_token: {r.text}")

        self._token = tok
        self._token_obtained_at = time.time()
        self.logger.info("Token refreshed successfully.")


# =============================
# Custom error classes
# =============================

class WatsonMLClientError(RuntimeError):
    def __init__(self, status: int, body: dict[str, Any] | str, hint: str = "") -> None:
        self.status = status
        self.body = body
        self.hint = hint
        msg = f"WML request failed with HTTP {status}.\nBody: {body}"
        if hint:
            msg += f"\n\nHints:\n{hint}"
        super().__init__(msg)


class WatsonMLNetworkError(RuntimeError):
    """Raised when a network error occurs during a request."""
    pass


class WatsonMLAuthError(RuntimeError):
    """Raised when IAM authentication fails."""
    pass
