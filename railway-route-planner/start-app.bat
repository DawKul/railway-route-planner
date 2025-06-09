@echo off
echo Uruchamiam Railway Route Planner...
:: Uruchomienie backendu
start cmd /k "cd backend && npm start"
:: Poczekaj 2 sekundy
timeout /t 2 /nobreak
:: Uruchomienie frontendu
start cmd /k "cd frontend && npm start"
echo Aplikacja zostala uruchomiona!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000 