const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const db = require('./db'); // Połączenie z bazą PostgreSQL

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint glowny

app.get('/', (req, res) => {
    res.send('Railway backend działa');
});

// Test połączenia z PostGIS
app.get('/test', async (req, res) => {
    try {
        const result = await db.any('SELECT PostGIS_Version();');
        res.json(result);
    } catch (err) {
        console.error('❌ Błąd zapytania:', err);
        res.status(500).send('Błąd połączenia z bazą');
    }
});

// Rejestracja użytkownika
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [
            username,
            hashedPassword,
        ]);
        res.status(201).send('Użytkownik zarejestrowany');
    } catch (err) {
        console.error('❌ Błąd rejestracji:', err);
        res.status(500).send('Błąd rejestracji');
    }
});

// Logowanie
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);

        if (!user) {
            return res.status(401).send('❌ Nieprawidłowy login lub hasło');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).send('❌ Nieprawidłowy login lub hasło');
        }

        res.send('Zalogowano pomyślnie');
    } catch (err) {
        console.error('❌ Błąd logowania:', err);
        res.status(500).send('Błąd logowania');
    }
});

// Zapis trasy
app.post("/routes", async (req, res) => {

  const { name, route, stops, max_wagons, slope } = req.body;


    console.log("🛠️ Otrzymano do zapisu:", { name, route, stops });

    if (!name || !Array.isArray(route) || route.length === 0) {
        return res.status(400).send("❌ Błędne dane trasy");
    }

    try {
        const geojson = {
            type: "LineString",
            coordinates: route,
        };

        const geojsonString = JSON.stringify(geojson);
        const stopsString = JSON.stringify(stops || []);

    await db.none(
      `INSERT INTO routes (name, geojson, stops, max_wagons, slope)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)`,
      [name, geojson, stopsJson, max_wagons, slope]
    );

    res.status(201).send("Zapisano trase");
  } catch (err) {
    console.error("? Blad zapisu trasy:", err.message);
    res.status(500).send("Blad zapisu trasy: " + err.message);
  }

});

// Pobieranie tras
app.get('/routes', async (req, res) => {
    try {
        const result = await db.any('SELECT * FROM routes ORDER BY id DESC');
        res.json(result);
    } catch (err) {
        console.error("❌ Błąd pobierania tras:", err.message);
        res.status(500).send("Błąd pobierania tras: " + err.message);
    }
});

// Uruchomienie serwera
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚉 Serwer działa na http://localhost:${PORT}`);
});
