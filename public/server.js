const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = path.join(__dirname, '..');
const databasePath = path.join(rootDir, 'rentgraud.sqlite');

const db = new sqlite3.Database(databasePath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'rentgraud-session-secret',
    resave: false,
    saveUninitialized: false
  })
);

app.use(express.static(rootDir));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ success: false, message: 'Not authenticated.' });
    return;
  }

  res.json({ success: true, user: req.session.user });
});

app.post('/api/signup', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(409).json({ success: false, message: 'That email is already registered.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash]);

    res.status(201).json({ success: true, userId: result.lastID, message: 'Account created.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Signup failed on the server.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const user = await get('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    req.session.user = {
      id: user.id,
      email: user.email
    };

    res.json({ success: true, message: 'Login successful.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed on the server.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out.' });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`RentGraud server running at http://localhost:${port}`);
  });
}

module.exports = app;