# SpendWise - Smart Expense Tracking for Uganda

A comprehensive expense tracking web application with full-stack implementation, featuring dashboard analytics, financial goals, currency conversion, offline support, and detailed reporting.

## Features

- ✅ User Authentication (Signup/Login with JWT)
- ✅ Dashboard with Interactive Charts (Pie, Bar, Line charts)
- ✅ Expense & Income Management (CRUD operations)
- ✅ Financial Goals Tracking with Progress Visualization
- ✅ Multi-Currency Support (UGX, USD, EUR, GBP, KES, TZS) with Automatic Conversion
- ✅ Offline Support (Queue expenses when offline, sync when online)
- ✅ Comprehensive Reports (Day, Week, 2 Weeks, 3 Weeks, Month)
- ✅ Export to PDF and CSV
- ✅ Pagination for Large Data Sets
- ✅ Mobile-Responsive Design
- ✅ Uganda-Specific Categories

## Tech Stack

### Frontend
- HTML5, CSS3, Vanilla JavaScript (ES6)
- Chart.js for data visualization
- jsPDF + html2canvas for PDF export
- LocalStorage for offline queue

### Backend
- Node.js with Express
- PostgreSQL database
- JWT for authentication
- bcrypt for password hashing

## Project Structure

```
spendwise/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── migrations/
│   │   ├── 001_create_tables.sql
│   │   └── 002_create_demo_user.sql
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── expenses.js          # Expense routes
│   │   ├── income.js            # Income routes
│   │   ├── goals.js             # Goals routes
│   │   ├── reports.js           # Reports routes
│   │   └── categories.js        # Categories routes
│   ├── utils/
│   │   └── currency.js          # Currency conversion utilities
│   ├── package.json
│   ├── server.js                # Express server
│   └── .env.example
├── frontend/
│   ├── css/
│   │   └── style.css           # Main stylesheet
│   ├── js/
│   │   ├── api.js              # API client
│   │   ├── currency.js          # Currency conversion (frontend)
│   │   ├── offline.js          # Offline queue management
│   │   ├── dashboard.js        # Dashboard functionality
│   │   ├── goals.js            # Goals page
│   │   ├── expenses.js         # Expenses page
│   │   ├── income.js           # Income page
│   │   └── reports.js          # Reports page
│   ├── index.html              # Landing page
│   ├── signup.html             # Signup page
│   ├── login.html              # Login page
│   ├── dashboard.html          # Main dashboard
│   ├── goals.html              # Goals management
│   ├── expenses.html           # Expenses list
│   ├── income.html             # Income list
│   └── reports.html            # Reports page
├── docker-compose.yml          # PostgreSQL container
└── README.md
```

## Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (or use Docker)
- npm or yarn

### 1. Database Setup

#### Option A: Using Docker (Recommended)tiff24023

```bash
# Start PostgreSQL container
docker-compose up -d

# The database will be automatically initialized with migrations
```

#### Option B: Manual PostgreSQL Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE spendwise_db;
CREATE USER spendwise_user WITH PASSWORD '87654321';
GRANT ALL PRIVILEGES ON DATABASE spendwise_db TO spendwise_user;
```

2. Run migrations:
```bash
psql -U spendwise_user -d spendwise_db -f backend/migrations/001_create_tables.sql
psql -U spendwise_user -d spendwise_db -f backend/migrations/002_create_demo_user.sql
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install


# Copy environment file
cp .env.example .env

# Edit .env file with your database credentials
# Default values:
# PORT=3000
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=spendwise_db
# DB_USER=spendwise_user
# DB_PASSWORD=87654321
# JWT_SECRET=your-secret-key-change-in-production
# NODE_ENV=development

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

The backend API will be running on `http://localhost:3000`

### 3. Frontend Setup

The frontend is static HTML/CSS/JS, so you can:

#### Option A: Use a Local Server

```bash
# Using Python
cd frontend
python -m http.server 8000

# Using Node.js http-server
npx http-server frontend -p 8000

# Using PHP
php -S localhost:8000 -t frontend
```

#### Option B: Open Directly

Simply open `frontend/index.html` in your browser (note: some features may not work due to CORS)

#### Option C: Configure CORS (If needed)

If you encounter CORS issues, make sure the backend `server.js` has CORS enabled (it's already configured).

### 4. Create Demo User

The demo user is created automatically via migration. However, if you need to create it manually:

**Demo Account Credentials:**
- Email: `demo@spendwise.com`
- Password: `demo123`

To create the demo user manually, run this SQL (you'll need to generate a proper bcrypt hash):

```sql
-- Generate password hash for 'demo123' using Node.js:
-- const bcrypt = require('bcrypt');
-- bcrypt.hash('demo123', 10).then(hash => console.log(hash));

-- Then insert:
INSERT INTO users (full_name, email, password_hash, phone, preferred_currency)
VALUES (
    'Demo User',
    'demo@spendwise.com',
    '$2b$10$YOUR_BCRYPT_HASH_HERE',
    '+256700000000',
    'UGX'
) ON CONFLICT (email) DO NOTHING;
```

Or use the provided script:

```bash
cd backend
node scripts/create-demo-user.js
```

## Usage

### 1. Access the Application

Open your browser and navigate to:
- Frontend: `http://localhost:8000` (or your configured port)
- Backend API: `http://localhost:3000`

### 2. Sign Up or Login

- **New User**: Click "Sign Up" and create an account
- **Demo User**: Use `demo@spendwise.com` / `demo123`

### 3. Dashboard

- View total income, expenses, and balance
- Switch currency using the dropdown (all amounts convert automatically)
- View charts: Expenses by Category (Pie), Weekly Spending (Bar), Income vs Expenses (Line)
- Add expenses and income using the quick action buttons
- View recent transactions and goals preview

### 4. Manage Expenses & Income

- Navigate to "Expenses" or "Income" pages
- Use filters to search by category, date range, or keyword
- Add, edit, or delete transactions
- Export to CSV

### 5. Set Financial Goals

- Go to "Goals" page
- Create goals with target amounts and deadlines
- Track progress with visual progress bars
- Hover over goals to see remaining amount and days left

### 6. Generate Reports

- Navigate to "Reports" page
- Select time period (Day, Week, 2 Weeks, 3 Weeks, Month)
- View detailed breakdowns by category and source
- Export to PDF or CSV

### 7. Offline Support

- Add expenses even when offline
- Expenses are queued in localStorage
- Automatically syncs when connection is restored

## Currency Conversion

The application supports automatic currency conversion between:
- UGX (Ugandan Shilling) - Default
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- KES (Kenyan Shilling)
- TZS (Tanzanian Shilling)

### How It Works

1. **Conversion Rates**: Defined in `backend/utils/currency.js` and `frontend/js/currency.js`
   - Default rate: 1 USD = 3600 UGX
   - Rates can be updated in the code or via API (future enhancement)

2. **User Preference**: Each user has a `preferred_currency` stored in the database

3. **Automatic Conversion**: 
   - When user switches currency, all displayed amounts convert
   - Charts update with converted values
   - Reports export in selected currency
   - Original currency is preserved in database

4. **Adding Transactions**: Users can add expenses/income in any currency. The system stores the original currency and converts for display based on user preference.

### Updating Conversion Rates

To update rates, modify the `rates` object in:
- `backend/utils/currency.js`
- `frontend/js/currency.js`

For production, consider integrating with a currency API:
- ExchangeRate-API
- Fixer.io
- Open Exchange Rates

## API Endpoints

### Authentication
- `POST /api/signup` - Create new user
- `POST /api/login` - Login user
- `GET /api/me` - Get current user
- `POST /api/logout` - Logout user
- `PUT /api/currency` - Update preferred currency

### Expenses
- `GET /api/expenses` - Get expenses (with pagination, filters)
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `GET /api/expenses/summary` - Get expense summary

### Income
- `GET /api/income` - Get income records
- `POST /api/income` - Create income
- `PUT /api/income/:id` - Update income
- `DELETE /api/income/:id` - Delete income
- `GET /api/income/summary` - Get income summary

### Goals
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Reports
- `GET /api/reports/summary?period=day|week|2weeks|3weeks|month` - Get report summary
- `GET /api/reports/export?period=&format=csv` - Export report

### Categories
- `GET /api/categories?type=expense|income` - Get categories

## Database Schema

### Users
- id, full_name, email, password_hash, phone, preferred_currency, created_at

### Expenses
- id, user_id, amount, currency, category, description, date, created_at

### Income
- id, user_id, amount, currency, source, date, created_at

### Goals
- id, user_id, title, target_amount, progress, deadline, created_at

### Sessions
- id, user_id, token, created_at

### Categories
- id, name, type (expense/income), created_at

## Testing

### Test Signup/Login

1. **Signup**:
   ```bash
   curl -X POST http://localhost:3000/api/signup \
     -H "Content-Type: application/json" \
     -d '{
       "full_name": "Test User",
       "email": "test@example.com",
       "password": "test123",
       "preferred_currency": "UGX"
     }'
   ```

2. **Login**:
   ```bash
   curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "demo@spendwise.com",
       "password": "demo123"
     }'
   ```

3. **Get User Info** (use token from login):
   ```bash
   curl http://localhost:3000/api/me \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## Troubleshooting

### Database Connection Issues

1. Check PostgreSQL is running:
   ```bash
   docker ps  # If using Docker
   # or
   sudo systemctl status postgresql
   ```

2. Verify credentials in `.env` file

3. Test connection:
   ```bash
   psql -U spendwise_user -d spendwise_db -h localhost
   ```

### CORS Issues

- Ensure backend CORS is enabled (already configured)
- Check API_BASE_URL in `frontend/js/api.js` matches your backend URL

### Offline Queue Not Syncing

- Check browser console for errors
- Verify `offline.js` is loaded
- Check localStorage for `pendingExpenses`

### Charts Not Displaying

- Ensure Chart.js CDN is loaded
- Check browser console for JavaScript errors
- Verify data is being fetched correctly

## Production Deployment

### Security Considerations

1. **Change JWT Secret**: Update `JWT_SECRET` in `.env` to a strong random string
2. **Use HTTPS**: Always use HTTPS in production
3. **Database Security**: Use strong passwords and restrict database access
4. **Environment Variables**: Never commit `.env` file to version control
5. **Rate Limiting**: Add rate limiting to API endpoints
6. **Input Validation**: Add more robust input validation
7. **SQL Injection**: Use parameterized queries (already implemented)

### Deployment Steps

1. Set up PostgreSQL on your server
2. Configure environment variables
3. Run database migrations
4. Deploy backend (Node.js/Express)
5. Deploy frontend (static files or build)
6. Configure reverse proxy (nginx) if needed
7. Set up SSL certificate

## License

This project is open source and available for educational purposes.

## Support

For issues or questions, please check the troubleshooting section or create an issue in the repository.

---

**Built with ❤️ for Uganda**

