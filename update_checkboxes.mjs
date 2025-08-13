import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create a simple in-memory storage
const users = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    rights: ['admin', 'manager', 'team_leader', 'auditor', 'ma'],
    isInactive: false
  },
  {
    id: 2,
    username: 'auditor',
    password: 'password',
    rights: ['auditor'],
    isInactive: false
  }
];

// Initialize localStorage in the browser
app.get('/init-storage.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    // Initialize localStorage with default data
    localStorage.setItem('qa-users', JSON.stringify(${JSON.stringify(users)}));
    console.log('LocalStorage initialized with default users');
  `);
});

// Authentication routes
let currentUser = null;

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    currentUser = user;
    res.json(user);
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/user', (req, res) => {
  if (currentUser) {
    res.json(currentUser);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.post('/api/logout', (req, res) => {
  currentUser = null;
  res.json({ success: true });
});

// Serve static files
app.use(express.static('client/dist'));

// All other routes should serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Start the server
const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Default users:');
  console.log('- admin/admin123 (admin rights)');
  console.log('- auditor/password (auditor rights)');
});