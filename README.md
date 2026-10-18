# Docker quick start

Start backend + UI with Docker Compose:

- docker-compose up --build

Open:
- Backend: http://localhost:3000
- UI: http://localhost:3001

Run smoke test (wait until backend is ready):
- BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh
