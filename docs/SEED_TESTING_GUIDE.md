# Seed Data & Role-Based Access Testing Guide

This document provides comprehensive instructions for populating the database with test data and verifying role-based access control.

---

## 1. Running the Seed Script

### Prerequisites
- PostgreSQL database must be running
- Environment variables configured in `.env`
- Dependencies installed: `npm install`

### Running the Seed

The enhanced seed file is located at `prisma/seed-enhanced.ts`. To run it:

```bash
# Using npx tsx (recommended for TypeScript)
npx tsx prisma/seed-enhanced.ts

# Or using ts-node
npx ts-node prisma/seed-enhanced.ts

# Alternative: Use Prisma's seed command (requires configuration in package.json)
npx prisma db seed
```

### What the Seed Creates

| Category | Count | Details |
|----------|-------|---------|
| **Users** | 14 | All UserRole types |
| **Organizations** | 6 | 3 SHOP, 3 APPOINTMENT |
| **Organization Members** | 18 | All OrgMemberRole types |
| **Services** | 10+ | Beauty, Dental, SPA |
| **Appointments** | 7+ | Various statuses |
| **Orders** | 2 | Shop orders |
| **Reviews** | 3 | Organization reviews |
| **Follows** | 3 | Customer follows |

---

## 2. Test Credentials

### User Roles & Login Information

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **SUPER_ADMIN** | superadmin@example.com | password123 | Full system access |
| **ADMIN** | admin@shop.ir | password123 | All org management |
| **MANAGER** | manager@clinic.ir | password123 | Org team & services |
| **STAFF** | staff@shop.ir | password123 | Assigned tasks |
| **DRIVER** | driver@shop.ir | password123 | Delivery orders |
| **CUSTOMER** | customer1@example.com | password123 | Book & order |
| **SERVICE_PROVIDER** | dr.dermatologist@clinic.ir | password123 | View appointments |

### Login Steps

1. Navigate to: `http://localhost:3000/fa/login` (or your locale)
2. Enter the email from the table above
3. Enter password: `password123`
4. Click "ورود" (Login)
5. Redirected to dashboard based on role

---

## 3. Testing Role-Based Access Control

### A. SUPER_ADMIN Access

**Login:** superadmin@example.com

**Access:**
- ✅ All organizations visible
- ✅ System settings accessible
- ✅ User management
- ✅ View all data across organizations
- ✅ API: `GET /api/users` - all users
- ✅ API: `GET /api/organizations` - all orgs

**Dashboard URL:** `http://localhost:3000/fa/dashboard`

---

### B. ADMIN Access

**Login:** admin@shop.ir

**Access:**
- ✅ Organizations where user is ADMIN
- ✅ Manage organization settings
- ✅ Manage products/services
- ✅ View orders and appointments
- ✅ Manage team members
- ❌ Cannot access other organizations
- ❌ Cannot manage system users

**Dashboard URL:** `http://localhost:3000/fa/dashboard`

---

### C. MANAGER Access

**Login:** manager@clinic.ir

**Access:**
- ✅ Organizations where user is MANAGER
- ✅ Manage services and appointments
- ✅ View staff calendar
- ✅ View customer data
- ❌ Cannot change org settings
- ❌ Cannot add/remove team members

**Dashboard URL:** `http://localhost:3000/fa/dashboard`

---

### D. STAFF Access

**Login:** staff@shop.ir

**Access:**
- ✅ View assigned organization
- ✅ Perform assigned tasks
- ✅ View own schedule (if service provider)
- ❌ Cannot manage org settings
- ❌ Cannot view financials

**Dashboard URL:** `http://localhost:3000/fa/dashboard`

---

### E. CUSTOMER Access

**Login:** customer1@example.com

**Access:**
- ✅ Browse public organizations
- ✅ Book appointments
- ✅ Place orders
- ✅ View own appointments: `http://localhost:3000/fa/my-appointments`
- ❌ Cannot access dashboard
- ❌ Cannot view other customers

---

## 4. API Endpoint Testing

### Public Endpoints (No Auth Required)
```bash
# List organizations
GET /api/organizations

# Get organization by slug (public)
GET /api/public/organizations/clinic-ruya

# Get services
GET /api/services?organizationId={id}

# Get available slots
GET /api/services/{id}/slots?date=2024-01-15
```

### Protected Endpoints (Auth Required)

#### Customer Endpoints
```bash
# Get my appointments
GET /api/appointments

# Create appointment
POST /api/appointments
```

#### Staff/Manager/Admin Endpoints
```bash
# Get all appointments (org)
GET /api/appointments?organizationId={id}

# Update appointment
PATCH /api/appointments/{id}

# Get customers
GET /api/customers?organizationId={id}

# Manage services
POST /api/services
PATCH /api/services/{id}
```

#### Admin Only Endpoints
```bash
# Manage users
GET /api/users
PATCH /api/users/{id}

# Manage organizations
POST /api/organizations
PATCH /api/organizations/{id}

# Organization settings
GET /api/organizations/{id}/settings
PATCH /api/organizations/{id}/settings
```

---

## 5. UI Components by Role

### Dashboard Navigation

| Component | SUPER_ADMIN | ADMIN | MANAGER | STAFF | CUSTOMER |
|-----------|-------------|-------|---------|-------|----------|
| Dashboard Home | ✅ | ✅ | ✅ | ✅ | ❌ |
| Appointments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Calendar | ✅ | ✅ | ✅ | ✅ | ❌ |
| Customers | ✅ | ✅ | ✅ | ❌ | ❌ |
| Products | ✅ | ✅ | ❌ | ❌ | ❌ |
| Orders | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Team | ✅ | ✅ | ❌ | ❌ | ❌ |

⚠️ = Limited access

### Pages Accessible by Role

| Page | URL | Access |
|------|-----|--------|
| Login | `/[locale]/login` | All |
| Organization | `/[locale]/appointment/[slug]` | Public |
| Booking | `/[locale]/appointment/[slug]/booking` | Customer |
| My Appointments | `/[locale]/my-appointments` | Customer |
| Dashboard | `/[locale]/dashboard` | Staff+ |
| Calendar | `/[locale]/dashboard/calendar` | Staff+ |
| Appointments | `/[locale]/dashboard/appointments` | Staff+ |
| Customers | `/[locale]/dashboard/customers` | Manager+ |
| Products | `/[locale]/dashboard/products` | Admin |
| Orders | `/[locale]/dashboard/orders` | Admin |
| Settings | `/[locale]/dashboard/settings` | Admin |

---

## 6. Testing Checklist

### Super Admin Testing
- [ ] Login as superadmin@example.com
- [ ] Verify all 6 organizations visible in dashboard
- [ ] Can access settings page
- [ ] Can view all users
- [ ] API: GET /api/users returns all users
- [ ] API: GET /api/organizations returns all orgs

### Admin Testing
- [ ] Login as admin@shop.ir
- [ ] Dashboard shows only assigned organizations
- [ ] Can manage products/services
- [ ] Can view orders
- [ ] Cannot access system settings

### Manager Testing
- [ ] Login as manager@clinic.ir
- [ ] Can view calendar with appointments
- [ ] Can manage services
- [ ] Cannot access settings
- [ ] Cannot add team members

### Customer Testing
- [ ] Login as customer1@example.com
- [ ] Redirected away from dashboard
- [ ] Can browse organizations at `/fa/appointment/clinic-ruya`
- [ ] Can book appointment
- [ ] Can view own appointments at `/fa/my-appointments`

---

## 7. Database Schema Reference

### User Roles (enum UserRole)
```prisma
SUPER_ADMIN  // Full system access
ADMIN        // Organization admin
MANAGER      // Organization manager  
STAFF        // Staff member
DRIVER       // Delivery driver
CUSTOMER     // End customer
```

### Organization Member Roles (enum OrgMemberRole)
```prisma
ADMIN    // Full org control
MANAGER  // Manage team/services
STAFF    // Perform tasks
```

### Organization Types (enum OrganizationType)
```prisma
SHOP         // E-commerce
APPOINTMENT  // Booking/Scheduling
```

---

## 8. Troubleshooting

### Seed Not Running
```bash
# Check database connection
npx prisma db pull

# Reset database
npx prisma migrate reset

# Then run seed
npx tsx prisma/seed-enhanced.ts
```

### Login Not Working
- Verify user exists: Check database `User` table
- Verify password: Password is `password123` (hashed with bcrypt)
- Check NextAuth config in `lib/auth.ts`

### Wrong Redirect After Login
- Role-based redirect is in `app/[locale]/login/page.tsx`
- Check user's `role` field in database

---

## 9. Additional Test Data

### More Customers for Testing
| Email | Phone |
|-------|-------|
| customer2@example.com | +989100000007 |
| customer3@example.com | +989100000008 |
| customer4@example.com | +989100000009 |

### More Staff for Testing
| Email | Role |
|-------|------|
| dr.dermatologist@clinic.ir | Dermatologist |
| hairstylist@clinic.ir | Hair Stylist |
| masseur@spa.ir | Massage Therapist |
| beautician@clinic.ir | Beauty Consultant |

### Test Organizations
| Name | Slug | Type |
|------|------|------|
| کلینیک زیبایی رویا | clinic-ruya | APPOINTMENT |
| دندانپزشکی لبخند | dental-smile | APPOINTMENT |
| اسپا آرامش | spa-aramesh | APPOINTMENT |
| فروشگاه سلامت | salamat-shop | SHOP |
| سفارش غذا | khoone-food | SHOP |
| دیجی کالا | digikala-shop | SHOP |
