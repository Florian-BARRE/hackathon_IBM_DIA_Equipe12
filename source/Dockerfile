# Utiliser une image officielle Python comme base
FROM python:3.12-slim

# Répertoire de travail dans le conteneur
WORKDIR /app

# Mettre à jour pip et installer les certificats CA nécessaires
RUN apt-get update && apt-get install -y ca-certificates
RUN pip install --upgrade pip

# Copier le fichier requirements.txt
COPY requirements.txt .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier tous les fichiers du projet dans le conteneur
COPY . .

# Exposer le port sur lequel FastAPI sera exécuté
EXPOSE 8000

# Commande pour démarrer l'application FastAPI avec Uvicorn
CMD ["uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]