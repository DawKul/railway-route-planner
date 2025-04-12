const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const db = require('./db'); // Polaczenie z baza PostgreSQL

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint glówny
app.get('/', (req, res) => {
  res.send('Railway backend dziala');
});

// Endpoint testowy: sprawdza wersje PostGIS
app.get('/test', async (req, res) => {
  try {
    const result = await db.any('SELECT PostGIS_Version();');
    res.json(result);
  } catch (err) {
    console.error('? Blad zapytania:', err);
    res.status(500).send('Blad polaczenia z baza');
  }
});

// Rejestracja uzytkownika
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [
      username,
      hashedPassword,
    ]);

    res.status(201).send('Uzytkownik zarejestrowany');
  } catch (err) {
    console.error('Blad rejestracji:', err);
    res.status(500).send('Blad rejestracji');
  }
});

// Logowanie uzytkownika
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) {
      return res.status(401).send('? Nieprawidlowy login lub haslo');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).send('? Nieprawidlowy login lub haslo');
    }

    res.send('Zalogowano pomyslnie');
  } catch (err) {
    console.error('? Blad logowania:', err);
    res.status(500).send('Blad logowania');
  }
});

// Start serwera
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serwer dziala na http://localhost:${PORT}`);
});
