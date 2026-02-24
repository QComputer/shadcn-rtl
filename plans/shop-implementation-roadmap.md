# SHOP Organization Implementation Roadmap

## Executive Summary

This document outlines the implementation plan to complete the SHOP organization functionality, enabling visitors to browse products, manage a shopping cart, and place orders end-to-end.

---

## Current State Analysis

### ✅ Completed Components

#### Database Schema (Prisma)
- **Product Models**: `Product`, `ProductVariant`, `ProductCategory`
- **Order Models**: `Order`, `OrderItem`, `Payment`, `Promotion`
- **Cart Models**: `ShopCart`, `ShopCartItem`
- **Relations**: All properly configured with indexes

#### Backend Services
- [`productService`](lib/services/product.service.ts) - CRUD operations for products/variants
- [`cartService`](lib/services/cart.service.ts) - Cart management with inventory checks
- [`orderService`](lib/services/order.service.ts) - Order creation with promotion support

#### API Endpoints
| Endpoint | Methods | Status |
|----------|---------|--------|
| `/api/products` | GET, POST | ✅ Working |
| `/api/products/[id]` | GET, PUT, DELETE | ✅ Working |
| `/api/products/[id]/variants` | GET, POST | ✅ Working |
| `/api/cart` | GET, POST, DELETE | ⚠️ Requires Auth |
| `/api/cart/items/[id]` | PUT, DELETE | ⚠️ Requires Auth |
| `/api/orders` | GET, POST | ⚠️ Requires Auth |
| `/api/orders/[id]` | GET, PUT | ✅ Working |
| `/api/product-categories` | GET, POST | ✅ Working |

### ❌ Missing Components

#### 1. Public Shop Pages
- No public page for visitors to browse SHOP organization products
- No product detail page
- No category filtering UI

#### 2. Guest Cart System
- Current cart requires authenticated user
- No session-based cart for guests
- No cart persistence across sessions

#### 3. Guest Checkout Flow
- Order creation requires `customerId` (authenticated user)
- No guest customer creation
- No checkout page

#### 4. Dashboard Integration
- Products page uses hardcoded sample data
- Orders page uses hardcoded sample data
- Not connected to real API

---

## Implementation Phases

### Phase 1: Dashboard Integration (Priority: High)
*Connect existing dashboard pages to real API endpoints*

#### 1.1 Products Dashboard Page
**File**: [`app/[locale]/dashboard/products/page.tsx`](app/[locale]/dashboard/products/page.tsx)

**Changes Required**:
- Replace `sampleProducts` with API fetch from `/api/products`
- Add organization filter based on user membership
- Add create/edit product dialog
- Add delete confirmation
- Implement real pagination

**API Updates Needed**:
- Add `organizationId` filter to product list endpoint
- Auto-filter by user's organization for non-super-admin users

#### 1.2 Orders Dashboard Page
**File**: [`app/[locale]/dashboard/orders/page.tsx`](app/[locale]/dashboard/orders/page.tsx)

**Changes Required**:
- Replace `sampleOrders` with API fetch from `/api/orders`
- Add organization filter
- Add order detail modal/page
- Implement status update functionality
- Add real pagination

#### 1.3 My Orders Page (Customer)
**File**: [`app/[locale]/dashboard/my-orders/page.tsx`](app/[locale]/dashboard/my-orders/page.tsx)

**Changes Required**:
- Connect to `/api/orders?customerId=current`
- Show order history for logged-in customers

---

### Phase 2: Public Shop Pages (Priority: High)
*Enable visitors to browse products from SHOP organizations*

#### 2.1 Public Shop Organization Page
**New File**: `app/[locale]/shop/[slug]/page.tsx`

**Features**:
- Display organization info (logo, cover, description)
- List product categories
- Show products grid with filtering
- Search functionality
- Add to cart button

**API Updates Needed**:
- Create `/api/public/organizations/[slug]/shop` endpoint
- Return products with categories for SHOP type organizations

#### 2.2 Product Detail Page
**New File**: `app/[locale]/shop/[slug]/product/[productId]/page.tsx`

**Features**:
- Product images gallery
- Variant selection
- Quantity selector
- Add to cart functionality
- Related products

#### 2.3 Category Page
**New File**: `app/[locale]/shop/[slug]/category/[categoryId]/page.tsx`

**Features**:
- Products filtered by category
- Sorting options
- Grid/list view toggle

---

### Phase 3: Guest Cart System (Priority: High)
*Enable visitors to manage cart without authentication*

#### 3.1 Session-Based Cart Schema
**Database Changes**:

```prisma
model GuestCart {
  id          String       @id @default(cuid())
  sessionId   String       @unique
  organizationId String
  
  organization Organization @relation(fields: [organizationId], references: [id])
  items        GuestCartItem[]
  
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  expiresAt   DateTime     // Cart expiration (e.g., 7 days)
  
  @@index([sessionId])
  @@index([organizationId])
}

model GuestCartItem {
  id         String   @id @default(cuid())
  quantity   Int
  
  cartId     String
  variantId  String
  
  cart       GuestCart      @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variant    ProductVariant @relation(fields: [variantId], references: [id])
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@index([cartId])
  @@index([variantId])
}
```

#### 3.2 Session Management
**New File**: `lib/session.ts`

```typescript
// Generate and manage guest session IDs
export function getOrCreateSessionId(request: NextRequest): string
export function setSessionCookie(response: NextResponse, sessionId: string): void
```

#### 3.3 Guest Cart Service
**New File**: `lib/services/guest-cart.service.ts`

**Methods**:
- `getCart(sessionId, organizationId)` - Get or create guest cart
- `addItem(sessionId, organizationId, data)` - Add item to cart
- `updateItemQuantity(cartItemId, sessionId, data)` - Update quantity
- `removeItem(cartItemId, sessionId)` - Remove item
- `mergeToUserCart(sessionId, userId)` - Merge guest cart on login

#### 3.4 Guest Cart API
**New File**: `app/api/guest-cart/route.ts`

**Endpoints**:
- `GET ?organizationId=xxx` - Get cart (creates if not exists)
- `POST` - Add item to cart
- `DELETE` - Clear cart

---

### Phase 4: Guest Checkout (Priority: High)
*Enable visitors to place orders without account*

#### 4.1 Guest Customer Schema
**Database Changes**:

```prisma
model GuestCustomer {
  id        String   @id @default(cuid())
  name      String
  phone     String
  email     String?
  address   String?
  
  orders    Order[]
  
  createdAt DateTime @default(now())
  
  @@index([phone])
}
```

**Order Model Update**:
```prisma
model Order {
  // ... existing fields
  guestCustomerId String?
  guestCustomer   GuestCustomer? @relation(fields: [guestCustomerId], references: [id])
}
```

#### 4.2 Checkout Page
**New File**: `app/[locale]/shop/[slug]/checkout/page.tsx`

**Features**:
- Cart summary
- Customer information form (name, phone, email, address)
- Delivery/Pickup selection
- Payment method selection
- Order notes
- Place order button

#### 4.3 Checkout API
**New File**: `app/api/public/checkout/route.ts`

**Flow**:
1. Validate cart items and inventory
2. Create guest customer record
3. Create order with guest customer
4. Clear cart
5. Return order confirmation

#### 4.4 Order Confirmation Page
**New File**: `app/[locale]/shop/[slug]/order/[orderNumber]/page.tsx`

**Features**:
- Order details
- Estimated delivery/pickup time
- Contact information
- Order tracking (if applicable)

---

### Phase 5: Cart UI Components (Priority: Medium)

#### 5.1 Cart Drawer/Modal
**New File**: `components/shop/cart-drawer.tsx`

**Features**:
- Slide-out cart drawer
- Item list with quantity controls
- Remove item button
- Subtotal display
- Checkout button
- Persist across page navigation

#### 5.2 Cart Badge
**New File**: `components/shop/cart-badge.tsx`

**Features**:
- Show item count in header
- Update in real-time
- Link to cart/checkout

#### 5.3 Add to Cart Button
**New File**: `components/shop/add-to-cart-button.tsx`

**Features**:
- Variant selection dropdown
- Quantity input
- Add to cart action
- Loading state
- Success feedback

---

### Phase 6: Enhanced Features (Priority: Low)

#### 6.1 Product Reviews
- Add review functionality to products
- Display ratings on product cards

#### 6.2 Wishlist
- Save products for later
- Move to cart functionality

#### 6.3 Order Tracking
- Real-time order status updates
- SMS/Email notifications

#### 6.4 Inventory Alerts
- Low stock warnings
- Back-in-stock notifications

---

## Database Migration Plan

### Migration 1: Guest Cart Tables
```sql
-- Create GuestCart and GuestCartItem tables
-- Add relation to Organization
-- Add expiresAt with default 7 days
```

### Migration 2: Guest Customer
```sql
-- Create GuestCustomer table
-- Add guestCustomerId to Order table (nullable)
-- Add index on phone for lookup
```

---

## API Endpoints Summary

### New Endpoints Required

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public/organizations/[slug]/shop` | GET | Get shop org with products |
| `/api/public/products/[id]` | GET | Get public product details |
| `/api/guest-cart` | GET, POST, DELETE | Guest cart management |
| `/api/guest-cart/items/[id]` | PUT, DELETE | Guest cart item management |
| `/api/public/checkout` | POST | Guest checkout |

### Modified Endpoints

| Endpoint | Changes |
|----------|---------|
| `/api/products` | Add organizationId auto-filter for staff |
| `/api/orders` | Support guest customer orders |
| `/api/cart` | Add merge endpoint for guest→user conversion |

---

## Frontend State Management

### Cart State (Zustand)
**New File**: `lib/store/cart.ts`

```typescript
interface CartState {
  items: CartItem[]
  organizationId: string | null
  isLoading: boolean
  
  // Actions
  addItem: (variantId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  refreshCart: () => Promise<void>
}
```

### Session State
**New File**: `lib/store/session.ts`

```typescript
interface SessionState {
  sessionId: string | null
  isAuthenticated: boolean
  
  // Actions
  initSession: () => void
  mergeCartOnLogin: () => Promise<void>
}
```

---

## Implementation Order

### Week 1: Dashboard Integration
1. ✅ Connect products page to API
2. ✅ Connect orders page to API
3. ✅ Add organization filtering
4. ✅ Test CRUD operations

### Week 2: Public Shop Pages
1. ✅ Create public shop organization endpoint
2. ✅ Build shop landing page
3. ✅ Build product detail page
4. ✅ Build category page

### Week 3: Guest Cart
1. ✅ Database migration for guest cart
2. ✅ Session management
3. ✅ Guest cart service
4. ✅ Guest cart API
5. ✅ Cart UI components

### Week 4: Guest Checkout
1. ✅ Database migration for guest customer
2. ✅ Checkout page
3. ✅ Checkout API
4. ✅ Order confirmation page
5. ✅ End-to-end testing

---

## Testing Checklist

### Dashboard
- [ ] Products list loads from API
- [ ] Product CRUD operations work
- [ ] Orders list loads from API
- [ ] Order status updates work
- [ ] Organization filtering works

### Public Shop
- [ ] Shop page loads for SHOP organizations
- [ ] Products display correctly
- [ ] Category filtering works
- [ ] Search works
- [ ] Product detail page works

### Guest Cart
- [ ] Cart persists across page refreshes
- [ ] Add to cart works for guests
- [ ] Update quantity works
- [ ] Remove item works
- [ ] Cart merges on login

### Guest Checkout
- [ ] Checkout form validates
- [ ] Order creates successfully
- [ ] Inventory decrements
- [ ] Confirmation page shows
- [ ] Guest can view order status

---

## Security Considerations

1. **Rate Limiting**: Implement rate limiting on checkout endpoint
2. **Input Validation**: Strict validation on all guest inputs
3. **Session Security**: Secure, HTTP-only cookies for session IDs
4. **Inventory Protection**: Atomic inventory updates with transactions
5. **Order Verification**: Phone verification for high-value orders

---

## Performance Optimizations

1. **Caching**: Cache product listings with revalidation
2. **Pagination**: Implement cursor-based pagination for large catalogs
3. **Image Optimization**: Use Next.js Image component
4. **Lazy Loading**: Lazy load product images and cart drawer
5. **Debouncing**: Debounce search and quantity updates

---

## Conclusion

This roadmap provides a comprehensive plan to implement full SHOP organization functionality. The phased approach allows for incremental delivery while maintaining system stability.

**Estimated Total Effort**: 4 weeks
**Critical Path**: Guest Cart → Guest Checkout
**Dependencies**: None (all prerequisites exist)
