# 🔧 LocalFix — Home Services Marketplace

> **Book trusted local workers instantly** — Plumbers, Electricians, AC Technicians, and more. Real-time tracking, secure payments, live chat.

![LocalFix Banner](https://img.shields.io/badge/LocalFix-Home%20Services-2dbe6c?style=for-the-badge&logo=homeadvisor&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=white)


---

## 📱 What is LocalFix?

LocalFix is a **full-stack home service marketplace** inspired by Urban Company. Users can book verified local workers in real-time. Workers receive instant job requests, track earnings, and get paid directly to their bank accounts.

Built as a solo full-stack project to demonstrate end-to-end product development — from GPS-based worker matching to live Socket.io events and Razorpay payment integration.

---

## ✨ Features

### 👤 User Side
- 📧 Email OTP signup & JWT login
- 📍 GPS-based worker discovery (geospatial queries)
- 🔍 Category filters — AC, Plumber, Electrician, Carpenter, etc.
- ⚡ Real-time booking with live worker tracking on map
- 💬 In-app chat with assigned worker
- 💳 Razorpay payment integration (with platform fee)
- ⭐ Rate & review workers post-job
- 🔔 Real-time push notifications
- 📋 Booking history & "Book Again" feature
- ❤️ Save favourite workers

### 🔨 Worker Side
- 📱 Phone OTP signup & JWT login
- 🟢 Online/Offline availability toggle
- 📍 Auto GPS location update when online
- 🔔 Instant job request notifications via Socket.io
- ✅ Accept/Reject bookings
- 🗺️ Live location sharing with user during job
- 🔐 OTP-based job start verification
- 💰 Wallet system with auto earnings tracking
- 📊 Dashboard — Total jobs, rating, monthly earnings
- 🏦 Bank account & payout management
- 📤 Withdrawal requests

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Real-time | Socket.io |
| Auth | JWT + bcrypt |
| Payments | Razorpay |
| Email OTP | Nodemailer (Gmail) |
| SMS OTP | Fast2SMS |
| File Upload | Multer |
| Maps | Leaflet.js / Geolocation API |

---

## 🏗️ System Architecture

```
┌─────────────────┐         ┌──────────────────────┐
│   User Browser  │◄───────►│   Express.js Server  │
│  (HTML/CSS/JS)  │  REST   │    (Port 3000)       │
└─────────────────┘  +      └──────────┬───────────┘
                     Socket.io         │
┌─────────────────┐                    ├──► MongoDB
│ Worker Browser  │◄───────────────────┤    (Geospatial)
│  (HTML/CSS/JS)  │                    │
└─────────────────┘                    ├──► Razorpay API
                                       │
                                       ├──► Nodemailer
                                       │
                                       └──► Fast2SMS
```

---

## 🔄 Booking Flow

```
User books service
       │
       ▼
GPS coordinates captured
       │
       ▼
MongoDB $near query finds nearest online worker
       │
       ▼
Socket.io → Worker gets instant notification
       │
       ├── Worker Accepts → User gets worker details + live map
       │
       ├── User shares OTP → Worker verifies → Job starts
       │
       ├── Worker sets amount → User pays via Razorpay
       │
       └── User marks complete → Rating → Wallet updated
```

---

## 📂 Project Structure

```
localfix/
├── server.js              # Main Express + Socket.io server
├── .env                   # Environment variables
├── uploads/               # Worker profile photos
├── package.json
└── frontend/
    └── index.html         # Complete frontend (SPA)
```

---

## ⚙️ Setup & Run Locally

### Prerequisites
- Node.js v18+
- MongoDB running locally
- Gmail account (for OTP)
- Razorpay account (test mode)

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/localfix.git
cd localfix
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create `.env` file
```env
JWT_SECRET=your_jwt_secret_here
EMAIL=your_gmail@gmail.com
APP_PASS=your_gmail_app_password
FAST2SMS_KEY=your_fast2sms_api_key
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### 4. Start MongoDB
```bash
mongod
```

### 5. Start server
```bash
node server.js
```

### 6. Open frontend
Open `frontend/index.html` with Live Server (VS Code) on port 5500.

---

## 🔌 API Routes

### Auth (User)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Register with email OTP |
| POST | `/api/auth/verify-otp` | Verify email OTP |
| POST | `/api/auth/login` | Login with JWT |
| GET | `/api/auth/profile` | Get user profile |
| PUT | `/api/auth/profile` | Update profile |

### Auth (Worker)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/worker/register` | Register with phone OTP |
| POST | `/api/worker/verify-otp` | Verify phone OTP |
| POST | `/api/worker/login` | Login with JWT |
| GET | `/api/worker/profile` | Get profile + stats |
| PUT | `/api/worker/profile` | Update profile |
| PUT | `/api/worker/location` | Update GPS location |

### Booking
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/booking/create` | Create booking (GPS match) |
| POST | `/api/booking/:id/verify-otp` | Worker verifies OTP |
| POST | `/api/booking/:id/amount` | Worker sets amount |
| POST | `/api/booking/:id/complete` | Mark job complete |
| POST | `/api/booking/:id/cancel` | Cancel booking |
| POST | `/api/booking/:id/rating` | Rate worker |

### Payments
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/payment/create-order` | Create Razorpay order |
| POST | `/api/payment/verify` | Verify payment signature |
| POST | `/api/worker/withdraw` | Request withdrawal |

---

## 🔴 Real-time Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `worker-register` | Client→Server | Worker comes online |
| `user-register` | Client→Server | User connects |
| `new-booking` | Server→Worker | New job request |
| `booking-accepted` | Worker→Server | Worker accepts job |
| `worker-accepted` | Server→User | Notify user |
| `booking-rejected` | Worker→Server | Worker rejects |
| `worker-location` | Worker→Server | Live GPS update |
| `worker-location-update` | Server→User | Forward location |
| `job-started` | Worker→Server | OTP verified, job began |
| `payment-request` | Worker→Server | Worker sends amount |
| `payment-done` | Server→Both | Payment verified |
| `job-completed` | Server→Worker | User marked complete |
| `send-message` | Client→Server | Chat message |
| `receive-message` | Server→Both | Deliver message |

---

## 🌍 Deployment

🌐 Live Demo: https://localfix-seven.vercel.app/

| Service | Platform |
|---------|----------|
| Backend | Render / Railway |
| Frontend | Vercel / Netlify |
| Database | MongoDB Atlas |

---

## 👨‍💻 Author

**Kaif** — B.Tech CSE, Lovely Professional University  
- 250+ LeetCode problems solved  
- 4⭐ HackerRank (Java)  
- Secured rank 1625/28,000+ in LeetCode Biweekly Contest 179 (top 15%) with rating 1710.

---

## 📄 License

MIT License — feel free to use for learning purposes.
