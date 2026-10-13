# CampusKit

## Run

Start Docker Desktop, then run these commands from the project root:

```bash
cp .env.example .env
docker compose up -d --build
```

Wait for the services to start, then open [http://localhost:8080](http://localhost:8080).

## Demo accounts

| Account | Email | Password |
| --- | --- | --- |
| Owner | owner@student.chula.ac.th | demo12345 |
| Renter | renter@student.chula.ac.th | demo12345 |
| Admin | admin@student.chula.ac.th | demo12345 |

Use separate tabs for the owner and renter.

## Stop and restart

```bash
# Stop the services (data is preserved)
docker compose stop

# Start them again
docker compose up -d
```
