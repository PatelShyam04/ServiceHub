# ServiceHub 🛠️

**ServiceHub** is an end-to-end web platform that connects customers with verified local service providers (e.g., plumbers, electricians, home repair technicians, appliance specialists). It streamlines service discovery, booking, real-time messaging, provider verification, and rating reviews.

---

## 🌟 Key Features

- **Multi-Role User Authentication**: Dedicated capabilities for **Customers**, **Service Providers**, and **System Administrators** (JWT Auth & Google OAuth).
- **Service Discovery & Search**: Filter service providers by category, availability, rating, and city location.
- **Booking Management System**: Easy booking flow with problem descriptions, photo attachments, schedule selections, and status tracking (Pending, Confirmed, Completed, Cancelled).
- **Real-Time Communication**: Built-in chat messaging powered by Django Channels & WebSockets.
- **Admin Management Panel**: Dashboard for verifying service providers, monitoring system stats, and managing users/services.
- **Reviews & Ratings**: Customer rating system to ensure service quality and provider accountability.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18+ with Vite
- **Styling**: Tailwind CSS & Lucide Icons
- **HTTP Client**: Axios
- **Charts & PDF**: Recharts & PDF utilities

### Backend
- **Framework**: Django 5+ & Django REST Framework (DRF)
- **Real-Time WebSockets**: Django Channels & Daphne
- **Authentication**: `djangorestframework-simplejwt` & Google OAuth 2.0
- **Database**: PostgreSQL (with SQLite support for quick local dev)

---

## 📁 Project Structure

```text
ServiceHub/
├── backend/                  # Django REST API Backend
│   ├── accounts/             # User accounts, authentication & profile management
│   ├── services/             # Services, bookings, reviews, messaging & WebSockets
│   ├── service_hub/          # Project settings, URLs, ASGI/WSGI configuration
│   ├── manage.py             # Django CLI runner
│   ├── requirements.txt      # Python dependencies list
│   └── .env.example          # Sample backend environment config
│
├── frontend/                 # React + Vite Frontend
│   ├── src/                  # Components, pages, context, and assets
│   ├── package.json          # Node dependencies & scripts
│   ├── vite.config.js        # Vite configuration
│   └── .env.example          # Sample frontend environment config
│
└── README.md                 # Project documentation
```

---

## 🚀 Setup & Installation Guide

### Prerequisites
- **Node.js** (v18 or higher) & **npm**
- **Python** (v3.10 or higher)
- **PostgreSQL** (Optional if using default local SQLite fallback)

---

### Step 1: Backend Setup (Django API)

1. Open terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   - **Windows**:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure Environment Variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Update database credentials (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`) if using PostgreSQL.

5. Run Database Migrations:
   ```bash
   python manage.py migrate
   ```

6. *(Optional)* Seed Default Categories & Services:
   ```bash
   python manage.py seed_services
   ```

7. Start Django Development Server:
   ```bash
   python manage.py runserver
   ```
   The backend server will start at `http://localhost:8000/`.

---

### Step 2: Frontend Setup (React Application)

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install Node packages:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```

4. Start Frontend Development Server:
   ```bash
   npm run dev
   ```
   The web app will open at `http://localhost:5173/`.

---

## 🧪 Verification & Testing

### Running Backend Unit Tests
To run Django's automated test suite (26 passing test cases covering Auth, Accounts, Booking, Admin permissions, and Google OAuth):
```bash
cd backend
python manage.py test
```

### Verifying Production Build (Frontend)
To test the production asset bundler:
```bash
cd frontend
npm run build
```

---

## 📄 License
This project was developed for SEM-4 project evaluation.