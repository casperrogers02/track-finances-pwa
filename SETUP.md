# Quick Setup Guide

## Prerequisites
- Node.js (v14+)
- Docker (optional, for PostgreSQL)
- PostgreSQL (if not using Docker)

## Quick Start

### 1. Start Database (Docker)
```bash
docker-compose up -d
```
 
### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env if needed (defaults should work)
npm start
```

### 3. Create Demo User
```bash
cd backend
npm run create-demo
```

### 4. Start Frontend
```bash
# Option 1: Python
cd frontend
python -m http.server 8000

# Option 2: Node.js
npx http-server frontend -p 8000

# Option 3: PHP
php -S localhost:8000 -t frontend
```

### 5. Access Application
- Frontend: http://localhost:8000
- Backend API: http://localhost:3000

### 6. Login
- Email: `demo@spendwise.com`
- Password: `demo123`

## Troubleshooting

### Database Connection Failed
- Check PostgreSQL is running: `docker ps` or `sudo systemctl status postgresql`
- Verify credentials in `backend/.env`
- Test connection: `psql -U spendwise_user -d spendwise_db`

### Port Already in Use
- Change port in `backend/.env` (PORT=3001)
- Update `frontend/js/api.js` (API_BASE_URL)

### CORS Errors
- Ensure backend is running
- Check API_BASE_URL in frontend matches backend URL

## Next Steps
- See README.md for detailed documentation
- Customize categories in database
- Update currency rates if needed

