# SocialBook — Fullstack Social Media Application

A modern, full-stack social media application built with **NestJS**, **MongoDB**, **React 19**, and **Tailwind CSS**.

---

## 🚀 Features

- **Authentication & Security:**
  - Registration, Login, Logout with **Argon2** password hashing.
  - Stateful JWT access & refresh tokens stored in MongoDB.
  - Role-based and token-protected routes via `AuthGuard`.
- **Profiles:**
  - View & edit profile (Bio, Location, Website).
  - Direct image browse & upload for Avatar and Cover photos with live preview.
- **Posts & Feed:**
  - Create, view, edit, and delete posts.
  - Image attachment with direct file upload via Multer.
  - Personalized Friend Feed with pagination.
- **Social Interactions:**
  - **Likes:** Like / Unlike with atomic counters and duplicate prevention.
  - **Comments:** Add, edit, and delete comments on posts.
  - **Friends:** Send requests, accept, reject, cancel, unfriend, and search people.

---

## 📁 Project Structure

```text
├── backend/             # NestJS REST API + Mongoose Models
│   ├── config/          # Database configuration
│   ├── models/          # MongoDB schemas (User, Post, Like, Comment, Friendship, Auth)
│   ├── src/             # NestJS Modules, Controllers, Services, Middlewares
│   ├── uploads/         # Local uploaded media storage
│   ├── .env.example     # Backend environment template
│   └── package.json
│
├── frontend/            # React 19 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/         # Axios API client modules
│   │   ├── components/  # Reusable UI components (Navbar, PostCard, CreatePostBox, etc.)
│   │   ├── context/     # AuthContext (state, token management)
│   │   ├── pages/       # FeedPage, FriendsPage, ProfilePage, LoginPage, RegisterPage
│   │   └── types/       # TypeScript interface definitions
│   ├── .env.example     # Frontend environment template
│   └── package.json
│
└── .gitignore           # Global git ignore (ignores .env, node_modules, dist, uploads)
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) running locally on `mongodb://localhost:27017`

---

### 1. Setup Backend

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Start development server
npm run dev
```

- **Backend API:** `http://localhost:4000`
- **Swagger Documentation:** `http://localhost:4000/api/swagger`

---

### 2. Setup Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Start development server
npm run dev
```

- **Frontend App:** `http://localhost:5173`

---

## 🔒 Environment Variables

### Backend (`backend/.env`)
- `SERVER_PORT=4000`
- `FRONTEND_URL=http://localhost:5173`
- `MONGODB_URI=mongodb://localhost:27017/social_media_db`
- `JWT_ACCESS_TOKEN_SECRET=<your-secret>`
- `JWT_REFRESH_TOKEN_SECRET=<your-secret>`

### Frontend (`frontend/.env`)
- `VITE_API_URL=http://localhost:4000/api`
