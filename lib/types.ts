import type {
  Organization,
  User,
  OrganizationMember,
  BusinessHour,
  ServiceCategory,
  Service,
  Appointment,
  ProductCategory,
  Product,
  ProductVariant,
  ShopCart,
  ShopCartItem,
  Order,
  OrderItem,
  Payment,
  Promotion,
  Review,
  Follow,
  Conversation,
  ConversationParticipant,
  Message,
  Location,
  OrganizationSettings,
  AuditLog,
  PasswordReset,
  EmailVerification,
} from "@prisma/client";

// Re-export all Prisma types
export type {
  User,
  Organization,
  OrganizationMember,
  BusinessHour,
  ServiceCategory,
  Service,
  Appointment,
  ProductCategory,
  Product,
  ProductVariant,
  ShopCart,
  ShopCartItem,
  Order,
  OrderItem,
  Payment,
  Promotion,
  Review,
  Follow,
  Conversation,
  ConversationParticipant,
  Message,
  Location,
  OrganizationSettings,
  AuditLog,
  PasswordReset,
  EmailVerification,
};

// Enums
export type OrganizationType = "SHOP" | "APPOINTMENT";
export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "STAFF"
  | "DRIVER"
  | "CUSTOMER";
//export type OrgMemberRole = "ADMIN" | "MANAGER" | "STAFF";
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type CartStatus = "ACTIVE" | "CHECKED_OUT" | "ABANDONED";
export type OrderType = "DELIVERY" | "PICK_UP";
export type OrderStatus = "PENDING" | "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "RECEIVED" | "REFUNDED";
export type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type PaymentMethod = "CREDIT_CARD" | "DEBIT_CARD" | "CASH" | "WALLET" | "BANK_TRANSFER";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "RESET_PASSWORD" | "VERIFY_EMAIL" | "ASSIGN_ROLE" | "CHANGE_STATUS";

// Extended types with relations
export type OrganizationWithRelations = Organization & {
  members?: OrganizationMemberWithUser[];
  businessHours?: BusinessHour[];
  serviceCategories?: ServiceCategoryWithServices[];
  productCategories?: ProductCategoryWithProducts[];
  settings?: OrganizationSettings | null;
  promotions?: Promotion[];
};

export type OrganizationMemberWithUser = OrganizationMember & {
  user: User;
};

export type ServiceCategoryWithServices = ServiceCategory & {
  services: ServiceWithProvider[];
};

export type ServiceWithProvider = Service & {
  serviceProvider: User | null;
};

export type ProductCategoryWithProducts = ProductCategory & {
  products: ProductWithVariants[];
};

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
};

export type UserWithRelations = User & {
  memberOf: OrganizationMemberWithOrganization[];
  orders: Order[];
  carts: ShopCart[];
  appointments: Appointment[];
  reviews: Review[];
};

export type OrganizationMemberWithOrganization = OrganizationMember & {
  organization: Organization;
};

export type OrderWithRelations = Order & {
  customer: User;
  organization: Organization;
  assignedDriver: User | null;
  items: OrderItemWithProduct[];
  payment: Payment | null;
  promotion: Promotion | null;
};

export type OrderItemWithProduct = OrderItem & {
  product: Product;
  variant: ProductVariant | null;
};

export type CartWithItems = ShopCart & {
  items: CartItemWithVariant[];
};

export type CartItemWithVariant = ShopCartItem & {
  variant: ProductVariant & {
    product: Product;
  };
};

// API Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchParams {
  query?: string;
  filters?: Record<string, unknown>;
}

// Session types
export interface SessionUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  locale: string;
  theme: string;
  isTeamMember: boolean;
  isActive: boolean;
}

// Auth types
export interface JWTPayload {
  sub: string;
  username: string;
  email?: string;
  role: UserRole;
  isTeamMember: boolean;
  locale: string;
  iat?: number;
  exp?: number;
}

// Organization context
export interface OrganizationContext {
  id: string;
  slug: string;
  name: string;
  type: OrganizationType;
  locale: string;
  timezone: string;
}

// RBAC types
export type Permission =
  | "org:create"
  | "org:read"
  | "org:update"
  | "org:delete"
  | "org:manage_members"
  | "org:manage_hours"
  | "service:create"
  | "service:read"
  | "service:update"
  | "service:delete"
  | "product:create"
  | "product:read"
  | "product:update"
  | "product:delete"
  | "order:create"
  | "order:read"
  | "order:update"
  | "order:assign_driver"
  | "order:manage"
  | "appointment:read"
  | "appointment:create"
  | "appointment:update"
  | "appointment:cancel"
  | "review:create"
  | "review:manage"
  | "user:manage"
  | "settings:manage"
  | "promotion:manage"
  | "payment:manage";

export const rolePermissions: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "org:create", "org:read", "org:update", "org:delete",
    "org:manage_members", "org:manage_hours",
    "service:create", "service:read", "service:update", "service:delete",
    "product:create", "product:read", "product:update", "product:delete",
    "order:read", "order:update", "order:assign_driver", "order:manage",
    "appointment:read", "appointment:create", "appointment:update", "appointment:cancel",
    "review:create", "review:manage", "user:manage",
    "settings:manage", "promotion:manage", "payment:manage"
  ],
  ADMIN: [
    "org:read", "org:update",
    "org:manage_members", "org:manage_hours",
    "service:create", "service:read", "service:update", "service:delete",
    "product:create", "product:read", "product:update", "product:delete",
    "order:read", "order:update", "order:assign_driver", "order:manage",
    "appointment:read", "appointment:create", "appointment:update", "appointment:cancel",
    "review:manage", "settings:manage", "promotion:manage", "payment:manage"
  ],
  MANAGER: [
    "org:read",
    "service:create", "service:read", "service:update", "service:delete",
    "product:create", "product:read", "product:update",
    "order:read", "order:update",
    "appointment:read", "appointment:create", "appointment:update",
    "settings:manage"
  ],
  STAFF: [
    "org:read",
    "service:create", "service:read", "service:update", "service:delete",
    "product:read",
    "order:read", "order:update",
    "appointment:read", "appointment:update"
  ],
  DRIVER: [
    "org:read",
    "order:read", "order:update"
  ],
  CUSTOMER: [
    "org:read",
    "service:read",
    "product:read",
    "order:read", "order:create",
    "appointment:read", "appointment:create", "appointment:cancel",
    "review:create"
  ]
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

// Audit log helper types
export interface AuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  organizationId?: string;
}
