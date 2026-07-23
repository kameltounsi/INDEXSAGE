# SAGE INDEX — portail unifié

Portail Angular + Spring Boot combinant les applications Traçabilité et Ressources Humaines.

## Architecture

- `frontend/` : Angular 22, écran de connexion, dashboard personnalisé et administration des comptes.
- `backend/` : Spring Boot 4.1, Spring Security, Spring Data JPA et base H2 locale.
- `backend/src/main/resources/data/users.json` : 432 comptes importés depuis `employes (1).xlsx`.

## Règle d’import

La valeur `TYPE DE TRAVAIL` est normalisée en majuscules. Toute valeur commençant par
`DIRECT` est exclue, ce qui couvre `DIRECT` et la valeur réelle `DIRECTS` du classeur.

- Employés analysés : 1 728
- Comptes créés : 432 (`CADRE` et `INDIRECTS`)
- Employés exclus : 1 296 (`DIRECTS`)
- Identifiant initial : matricule
- Statut initial : `ACTIVATION_REQUIRED`

Aucun mot de passe par défaut n’est stocké dans le dépôt. L’administrateur active un
compte via l’API `POST /api/accounts/{username}/activate` avec un mot de passe d’au
moins 12 caractères. Spring Security stocke uniquement son hash BCrypt.

## Démarrage

Pré-requis : Java 21 et Node.js compatible avec Angular 22.

```powershell
$env:PORTAL_ADMIN_PASSWORD = "un-mot-de-passe-administrateur-fort"
cd backend
.\mvnw.cmd spring-boot:run
```

Dans un autre terminal :

```powershell
cd frontend
npm install
npm start
```

Ouvrir `http://localhost:4200`, puis se connecter avec `admin` et la valeur de
`PORTAL_ADMIN_PASSWORD`.

## Vérifications

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm run build
```
