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
- Statut initial : `ACTIVATION_REQUIRED` pour les comptes importés et créés manuellement.
- Aucun mot de passe initial n'est dérivé des données d'un employé.
- Les comptes en attente d'activation ne peuvent pas se connecter.

## Activation et première connexion

1. L'administrateur se connecte avec le compte de démarrage configuré explicitement
   par l'environnement, puis ouvre l'administration des comptes.
2. Après vérification de l'identité du titulaire, il active un compte en attente.
   Le serveur génère un mot de passe temporaire aléatoire de 192 bits ; seul son
   hash BCrypt est conservé. Le mot de passe est affiché une seule fois dans cette
   réponse et doit être transmis au titulaire par un canal privé. Ne pas le
   conserver dans un ticket, des logs, le dépôt ou la documentation.
3. À sa première connexion, le titulaire doit choisir un mot de passe personnel
   de 12 à 72 caractères, différent du mot de passe temporaire et de son
   identifiant (72 octets UTF-8 maximum, limite BCrypt). Tant que cette étape n'est pas terminée, le serveur autorise
   uniquement le changement de mot de passe et la déconnexion : dashboard,
   administration et SSO restent interdits, même par appel direct à l'API.
4. Le changement invalide la session temporaire. Le titulaire se reconnecte
   avec son nouveau mot de passe pour accéder aux fonctionnalités habituelles.

L'activation est réservée au rôle `ADMIN` via
`POST /api/accounts/{username}/activate`, sans mot de passe fourni dans la requête.
Elle renvoie le compte et `temporaryPassword` avec `Cache-Control: no-store`.
Seuls les comptes `ACTIVATION_REQUIRED` sont activables ; elle ne sert pas à
réinitialiser un compte déjà actif ou désactivé. Il n'existe pas de récupération
publique du mot de passe temporaire : si celui-ci est perdu, une remise en attente
sans hash exige une intervention administrative contrôlée en base de données.

### Mise à niveau d'une installation existante

Au redémarrage, l'import invalide les mots de passe encore égaux au matricule
y compris ceux des comptes créés manuellement hors du fichier source,
retire leur hash et remet les comptes concernés en attente d'activation. Les
comptes désactivés restent désactivés. Les mots de passe personnels déjà distincts
et les activations en cours sont conservés ; un nouvel import ne les réinitialise
pas. Les anciens JWT de comptes remis en attente sont refusés immédiatement.

L'import respecte les rôles du fichier source ; aucun matricule codé en dur ne
confère désormais le rôle administrateur. Le compte de démarrage est séparé des
employés et utilise l'identifiant technique interne réservé `employeeId = -1`.
Prévoir la distribution des accès temporaires avant la mise à niveau.

## Déploiement Docker

Définir ces variables dans l'environnement du processus Docker Compose ou dans
un fichier `.env` local, exclu de Git. Aucun identifiant ni secret par défaut n'est
fourni pour l'administrateur :

| Variable | Usage |
| --- | --- |
| `PORTAL_ADMIN_USERNAME` | Identifiant explicite de l'administrateur, non numérique, sans espaces en début/fin, 40 caractères maximum |
| `PORTAL_ADMIN_PASSWORD` | Secret distinct de l'identifiant, au moins 12 caractères et 72 octets UTF-8 maximum |
| `JWT_SECRET` | Secret aléatoire indépendant, au moins 32 octets UTF-8 pour la signature des JWT |
| `POSTGRES_PASSWORD` | Secret de la base du portail |
| `TRACEABILITY_DB_PASSWORD` | Secret de la base Traçabilité |
| `HR_DB_PASSWORD` | Secret de la base RH |
| `PLANNING_DB_PASSWORD` | Secret de la base Planning |

Les variables `POSTGRES_DB`, `POSTGRES_USER`, les URL et les noms d'utilisateurs
techniques des bases doivent être adaptés à l'installation. Utiliser un générateur
cryptographique pour produire des secrets indépendants ; ne pas versionner `.env`.
Compose refuse le démarrage si une variable obligatoire manque ou est vide.

Le compte administrateur de démarrage est provisionné à partir de
`PORTAL_ADMIN_USERNAME` et `PORTAL_ADMIN_PASSWORD`. Il est actif explicitement pour
permettre l'activation des employés et n'utilise pas le parcours temporaire.
Son mot de passe se modifie via l'environnement, suivi d'un redémarrage du backend.
Le backend conserve le hash si le secret n'a pas changé ; sa modification invalide
les anciens JWT. Une collision avec l'identifiant d'un employé fait échouer le
démarrage plutôt que de lui accorder des privilèges.

Construire et démarrer la stack :

```powershell
docker compose up -d --build
```

Ouvrir `http://localhost:18080`, puis utiliser l'identifiant et le secret
administrateur configurés dans l'environnement.

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
`SPRING_DATASOURCE_PASSWORD`, `PORTAL_ADMIN_USERNAME`, `PORTAL_ADMIN_PASSWORD`,
`JWT_SECRET`, `TRACEABILITY_DB_PASSWORD`, `HR_DB_PASSWORD` et
`PLANNING_DB_PASSWORD`, puis lancer le backend
avec `.\mvnw.cmd spring-boot:run`. Le frontend se lance avec `npm start`.

## Vérifications

```powershell
cd backend
.\mvnw.cmd test

cd ..\frontend
npm run build
```
