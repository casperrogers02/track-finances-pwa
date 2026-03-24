const bcrypt = require('bcrypt');
const pool = require('../config/database');
require('dotenv').config();

async function createDemoUser() {
  try {
    const email = 'demo@spendwise.com';
    const password = 'demo123';
    const full_name = 'Demo User';
    const phone = '+256700000000';
    const preferred_currency = 'UGX';

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      console.log('Demo user already exists');
      process.exit(0);
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, phone, preferred_currency) VALUES ($1, $2, $3, $4, $5) RETURNING id, email',
      [full_name, email, password_hash, phone, preferred_currency]
    );

    console.log('Demo user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    process.exit(0);
  } catch (error) {
    console.error('Error creating demo user:', error);
    process.exit(1);
  }
}

createDemoUser();



