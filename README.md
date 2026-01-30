# UFwildlife🐊

UFwildlife is a community-driven web platform that allows University of Florida students and faculty to record, share, and explore the animals found on campus. 

The project follows a **separated frontend–backend architecture**, using Angular for the frontend and Go (Golang) for the backend API.

---

## 📌 Project Overview

UFwildlife brings campus to life through an interactive map where students capture and share the animals they meet every day in different seasons. Upload a photo, drop a pin, and tell your story — then explore what others have discovered across campus. It's more than a map; it's a shared memory that Gators have tucked into every corner of campus.

This project is developed by a small software engineering team as a full-stack web application.

---

## 🏗 System Architecture

```text
Browser
  ↓
Angular Frontend (http://localhost:4200)
  ↓  HTTP API requests
Go Backend API (http://localhost:8080)


## Set Up Environment

### 1️⃣ Install Node.js and npm (required for frontend)

- Download Node.js from: <span style="color:blue">https://nodejs.org/</span>  
- Recommended version: <span style="color:blue">Node.js 22.12+</span>

- Verify installation:

```bash
node -v
npm -v
```

---

### 2️⃣ Install Angular CLI (Global Tool)

- Install Angular CLI globally:

```bash
npm install -g @angular/cli
```

- Check version:

```bash
ng version
```

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
```

This installs all frontend dependencies defined in <span style="color:blue">package.json</span>.

---

### 4️⃣ Install Go (Required for Backend)

- Download Go from: <span style="color:blue">https://go.dev/dl/</span>  
- Verify installation:

```bash
go version
```

---

### 5️⃣ Backend Setup

This sets up Go modules for dependency management:

```bash
cd backend
go mod init parkinGator-backend  # only if not initialized
go mod tidy
```

---

## Run

### 1️⃣ Run Backend

```bash
cd backend
go run main.go
```

- Server runs at: <span style="color:blue">http://localhost:8080/api/parking</span>

---

### 2️⃣ Run Frontend

```bash
cd frontend
ng serve --open
```

- Server runs at: <span style="color:blue">http://localhost:4200</span>  
- Browser will open automatically

---

## Notes

- Make sure both frontend and backend are running simultaneously during development.
- Frontend communicates with backend through HTTP requests to endpoints like `/api/parking`.
- If you encounter permission issues with npm globally, you can fix them by:

```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```