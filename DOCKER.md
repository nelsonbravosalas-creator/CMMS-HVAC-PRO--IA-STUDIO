# CMMS HVAC PRO - Docker

## Requirements

- Docker Desktop running.
- A local environment file named `.env.local`.

## Configure

Copy the example file and set real values:

```powershell
Copy-Item .env.docker.example .env.local
```

Minimum required values for the local PostgreSQL profile:

```env
APP_PORT=3001
APP_URL=http://localhost:3001
POSTGRES_DB=cmms_hvac
POSTGRES_USER=cmms
POSTGRES_PASSWORD=cmms_password
POSTGRES_PORT=5432
DATABASE_URL=postgresql://cmms:cmms_password@postgres:5432/cmms_hvac
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=replace_with_your_gemini_key
```

For Neon, also set:

```env
NEON_DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require
```

## Run Local PostgreSQL

This starts the app and the local PostgreSQL container:

```powershell
docker compose --profile local up --build -d
```

## Run Neon

This starts only the app and connects it to `NEON_DATABASE_URL`:

```powershell
docker compose --profile neon up --build -d
```

Open:

```text
http://localhost:3001
```

From another device on the same LAN, use the host machine IP:

```text
http://192.168.100.43:3001
```

## Validate

```powershell
docker compose ps
docker compose logs -f cmms-hvac-pro-local
docker compose logs -f cmms-hvac-pro-neon
docker compose logs -f postgres
```

Database health:

```powershell
Invoke-RestMethod http://localhost:3001/api/health/db
```

## Stop

```powershell
docker compose down
```

To remove the local database volume too:

```powershell
docker compose down -v
```
