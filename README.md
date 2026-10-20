# PeopleDesk Pro — Enterprise Employee Management System

[![Version](https://img.shields.io/badge/version-2.0.0-059669.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-23%2F23%20passed-059669.svg)](TEST_REPORT.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-17211F.svg)](package.json)

**PeopleDesk Pro** is a modern, full-stack, enterprise-grade Employee Management System (EMS). Designed with a clean Emerald Green, Charcoal, and Off-White visual aesthetic, it provides complete employee lifecycle management, attendance tracking, payroll salary slips, digital ID badges, department analytics, and role-based access control.

---

## ⚡ Quick Demo Login Credentials

Anyone reviewing or testing the project can log in using these pre-seeded demo accounts:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| 👑 **Administrator** | `admin@peopledesk.com` | `Admin@123!` | Full admin access: employee CRUD, salary slips, audit logs, analytics |
| 👔 **HR Manager** | `meera.singh@example.com` | `HRManager@123!` | Management access: employee CRUD, departments, attendance, payroll |
| 👤 **Employee** | `aarav.sharma@example.com` | `Employee@123!` | Self-service: daily clock-in/out, view own profile & salary slip |

> 💡 *The database automatically seeds these accounts and 14 realistic employee profiles on first run with zero configuration required!*

---

## 🌟 Key Features

- **Employee Lifecycle Management (CRUD)**:
  - Add, list, search, filter, paginate, update, and delete employee records.
  - Multi-criteria filtering by department, employment type, and status.
  - Quick search across name, employee ID, email, and designation.
  - RFC 4180 compliant CSV export of employee directories.
- **Compensation & Salary Slips**:
  - Auto-calculated salary breakdown: Basic (50%), HRA (30%), Special Allowance, PF (12%), Professional Tax, and TDS.
  - Printable, formatted salary slips with dedicated print stylesheets (`@media print`).
- **Digital Identity Badges**:
  - Employee photo ID badges featuring company branding, employee ID, blood group, emergency contact details, and QR verification codes.
- **Daily Attendance System**:
  - Employee clock-in and clock-out with automatic late detection (>10:15 AM) and work hours calculation.
  - Real-time dashboard showing today's attendance rate, present count, late arrivals, and absences.
- **Analytics & Dashboard**:
  - High-level KPIs: Total headcount, active workforce, department counts, and monthly total payroll.
  - Interactive Chart.js department distribution chart with dynamic theme support.
  - Recent hires stream with status indicators.
- **Role-Based Access Control (RBAC)**:
  - Strict server-side authorization separating `admin`, `hr_manager`, and `employee` roles.
  - Employees have read-only access to their own profile, attendance, and salary slips.
- **Self-Healing Database Architecture**:
  - Automatic fallback to built-in in-memory MongoDB (`mongodb-memory-server`) if a local MongoDB service is unavailable.
  - Works straight out of the box with zero external database configuration required for evaluation.
- **Enterprise Security**:
  - Strict Helmet Content Security Policy (CSP).
  - Rate limiting on authentication and API routes.
  - Bcrypt password hashing (salt rounds: 10).
  - Session tokens stored securely in MongoDB (`connect-mongo`) with HTTP-only, SameSite cookies.
  - Comprehensive immutable audit logging.

---

## 🎨 Design System: Emerald Palette

PeopleDesk Pro strictly adheres to the Emerald visual identity:
- **Primary:** Emerald Green `#059669` (Dark: `#34D399`)
- **Light Emerald:** `#D1FAE5`
- **Sidebar:** Charcoal `#17211F` (Dark: `#101713`)
- **Background:** Off-White `#F8FAFC` (Dark: `#101713`)
- **Surfaces:** Pure White `#FFFFFF` (Dark: `#17211F`)
- **Borders:** `#E2E8F0` (Dark: `#34443A`)
- **Strict Color Standard:** Zero blue, cyan, or indigo accents throughout buttons, focus rings, hover states, charts, and dark theme.

---

## 📋 Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- *(Optional)* **MongoDB**: Local MongoDB instance on port 27017 or a MongoDB Atlas connection string. (If omitted, the built-in self-healing memory database launches automatically).

---

## 🚀 Quick Start & Installation

### 1. Clone & Install Dependencies
```bash
# Navigate to project directory
cd Employee_Management_System

# Install dependencies
npm install
```

### 2. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
*(Windows PowerShell)*:
```powershell
Copy-Item .env.example .env
```

Review `.env` settings:
```ini
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace_with_a_long_random_string_minimum_32_chars
MONGODB_URI=mongodb://localhost:27017/peopledesk
```

### 3. Start the Application
```bash
npm start
```
The server will start at `http://localhost:3000`.

---

## 👥 Default Demo Credentials

On first run, the database is automatically seeded with 6 departments, 14 employees, and 3 role-based test accounts:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@peopledesk.com` | `Admin@123!` | Full system access, audit logs, employee CRUD, payroll, settings |
| **HR Manager** | `meera.singh@example.com` | `HRManager@123!` | Employee CRUD, departments, attendance, salary slips |
| **Employee** | `aarav.sharma@example.com` | `Employee@123!` | Self-service attendance clocking, view own profile & salary slip |

> ⚠️ **Security Notice:** Change default passwords immediately before deploying to any public staging or production environment.

---

## 🧪 Automated Testing

PeopleDesk Pro includes an end-to-end integration and unit test suite powered by Node's native test runner (`node:test`):

```bash
# Run all automated tests
npm test
```

### Test Coverage Highlights:
- **Suite 1:** System Health & Infrastructure
- **Suite 2:** Authentication Flow & Session Management
- **Suite 3:** Role-Based Access Control (RBAC) Enforcement
- **Suite 4:** Employee CRUD, Validation, & Duplicate Prevention
- **Suite 5:** Salary Slip Computation & Deductions Breakdown
- **Suite 6:** Attendance Clock-in, Clock-out, & Statistics
- **Suite 7:** Dashboard KPI Analytics & Aggregation
- **Suite 8:** Leave Management & Audit Trail Logging

Results: **23 / 23 Tests Passed (100% Pass Rate)**. See [TEST_REPORT.md](TEST_REPORT.md) for full execution logs.

---

## 📁 Project Structure

```text
Employee_Management_System/
├── .env.example               # Environment template with placeholder values
├── CODE_DEDUPLICATION_REPORT.md# Report on removed legacy files & consolidated logic
├── PROJECT_AUDIT.md           # Comprehensive feature audit & verification matrix
├── TEST_REPORT.md             # Automated test suite run report
├── package.json               # Node.js dependencies and scripts
├── server.js                  # Express bootstrap, security headers & routing
├── src/
│   ├── config/
│   │   └── db.js              # Self-healing MongoDB connection & memory fallback
│   ├── controllers/
│   │   ├── attendanceController.js # Daily attendance, clocking & metrics
│   │   ├── auditController.js      # System audit trail
│   │   ├── authController.js       # Login, session verification & logout
│   │   ├── dashboardController.js  # Analytics & department distribution
│   │   ├── departmentController.js # Department management
│   │   ├── employeeController.js   # Employee CRUD, salary slips, CSV export
│   │   └── leaveController.js      # Leave requests & approval workflow
│   ├── middleware/
│   │   ├── auth.js            # RBAC session & role enforcement
│   │   └── rateLimiter.js     # Express rate limiters (bypassed in test mode)
│   ├── models/
│   │   ├── Attendance.js      # Attendance tracking schema
│   │   ├── AuditLog.js        # Audit trail schema
│   │   ├── Department.js      # Department schema
│   │   ├── Employee.js        # Employee master schema
│   │   ├── LeaveRequest.js    # Leave request schema
│   │   └── User.js            # User accounts & roles schema
│   └── utils/
│       ├── auditLogger.js     # Centralized audit logging utility
│       ├── csvExport.js       # RFC 4180 CSV serializer
│       └── seedData.js        # Realistic initial database seed generator
├── public/                    # Frontend client
│   ├── index.html             # Semantic single-page application shell
│   ├── css/
│   │   └── styles.css         # Emerald design system tokens & responsive layout
│   └── js/                    # Modular ES6 frontend controllers
│       ├── api.js             # Centralized fetch client
│       ├── app.js             # SPA routing & initialization
│       ├── attendance.js      # Attendance UI controller
│       ├── auth.js            # Authentication & session state
│       ├── dashboard.js       # KPI cards & Chart.js rendering
│       ├── departments.js     # Department directory
│       ├── employees.js       # Employee table, modals, salary slips & ID cards
│       ├── leaves.js          # Leave management modal & tables
│       └── theme.js           # Light/dark mode toggle & persistence
└── tests/
    └── api.test.js            # Complete automated test suite
```

---

## 🛠️ Production Deployment Guidelines

1. **Database**: Provide a managed MongoDB Atlas URI in `MONGODB_URI`.
2. **Session Security**: Set a cryptographically random 64-character string in `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Environment**: Set `NODE_ENV=production`. Cookies will automatically enforce `secure: true` (requires HTTPS).
4. **CORS**: Configure `CORS_ORIGIN` to match your production domain.
5. **Reverse Proxy**: When running behind Nginx, Cloudflare, or AWS ALB, ensure `trust proxy` is configured if rate-limiting by client IP.

---

## 📄 License

This project is licensed under the MIT License.
Built for **B.Y.T.E AVIP 2026** by ArithMatrix.
