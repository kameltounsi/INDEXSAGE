# SAGE INDEX — portail unifié

Portail React + Spring Boot combinant les applications Traçabilité, Ressources Humaines et Gestion des plannings.

## Architecture

- `frontend/` : React 19 + Vite, écran de connexion, dashboard personnalisé et administration des comptes.
- `backend/` : Spring Boot 4.1, Spring Security et Spring Data JPA.
- `postgres` : PostgreSQL 17 avec volume Docker persistant.
- `docker-compose.yml` : déploiement complet frontend + backend + PostgreSQL.
- `backend/src/main/resources/data/users.json` : 432 comptes importés depuis `employes (1).xlsx`.

## Règle d’import

La valeur `TYPE DE TRAVAIL` est normalisée en majuscules. Toute valeur commençant par
`DIRECT` est exclue, ce qui couvre `DIRECT` et la valeur réelle `DIRECTS` du classeur.

- Employés analysés : 1 728
- Comptes créés : 432 (`CADRE` et `INDIRECTS`)
- Employés exclus : 1 296 (`DIRECTS`)
- Identifiant initial : matricule
- Statut initial : `ACTIVE`
- Mot de passe initial : matricule

Chaque compte importé est actif par défaut. Son mot de passe initial est son
matricule ; Spring Security stocke uniquement le hash BCrypt de ce mot de passe.

## Déploiement Docker

Le fichier `.env` doit notamment contenir les variables suivantes :

```dotenv
POSTGRES_DB=sage_index
POSTGRES_USER=sage_index
POSTGRES_PASSWORD=un-mot-de-passe-postgres-fort
PORTAL_ADMIN_PASSWORD=un-mot-de-passe-administrateur-fort
PLANNING_DB_PASSWORD=mot-de-passe-de-la-base-plannings
```

Construire et démarrer la stack :

```powershell
docker compose up -d --build
```

Ouvrir `http://localhost:18080`, puis se connecter avec :

- Matricule : `admin`
- Mot de passe : valeur de `PORTAL_ADMIN_PASSWORD` dans `.env`

Le backend reste également accessible sur `http://localhost:18081`. PostgreSQL
n’est pas exposé sur la machine hôte ; seuls les conteneurs du réseau privé
Docker peuvent y accéder.

Commandes d’exploitation :

```powershell
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

`docker compose down` conserve les données. Pour supprimer aussi la base de
données, utiliser volontairement `docker compose down -v`.

## Démarrage sans Docker

Prérequis : PostgreSQL, Java 21 et Node.js 20 ou plus récent. Fournir
`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
`SPRING_DATASOURCE_PASSWORD` et `PORTAL_ADMIN_PASSWORD`, puis lancer le backend
avec `.\mvnw.cmd spring-boot:run`. Le frontend se lance avec `npm start`.

## Vérifications

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm run build
```
