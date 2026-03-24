require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

client.connect()
  .then(() => console.log('Connected to DB'))
  .then(() => client.query('TRUNCATE ai_chats RESTART IDENTITY CASCADE'))
  .then(() => {
    console.log('Successfully cleared all old AI conversations.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to clear conversations:', err);
    process.exit(1);
  });
