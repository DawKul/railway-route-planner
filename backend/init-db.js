const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
  const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres', // Connect to default database first
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  try {
    await client.connect();

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'railway_route_planner';
    await client.query(`
      SELECT 'CREATE DATABASE ${dbName}'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}')
    `);

    // Close connection to postgres database
    await client.end();

    // Connect to our new database
    const appClient = new Client({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: dbName,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 5432,
    });

    await appClient.connect();

    // Read and execute SQL files
    const sqlFiles = ['functions.sql', 'procedures.sql'].map(file => 
      path.join(__dirname, 'sql', file)
    );

    for (const file of sqlFiles) {
      if (fs.existsSync(file)) {
        const sql = fs.readFileSync(file, 'utf8');
        await appClient.query(sql);
        console.log(`Executed ${file}`);
      }
    }

    await appClient.end();
    console.log('Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// If this script is run directly
if (require.main === module) {
  initializeDatabase().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { initializeDatabase }; 