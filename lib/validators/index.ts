import { z } from "zod";
import { isReservedOrganizationSlug } from "@/lib/organization-slugs";

// Common validation patterns
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be less than 72 characters");

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format")
  .optional();

export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(255, "Email must be less than 255 characters");

export const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(10, "Slug must be less than 10 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
  .refine((slug) => !isReservedOrganizationSlug(slug), "Slug is reserved by the platform");

export const pageSchema = z.coerce.number().int().positive().default(1);
export const pageSizeSchema = z.coerce.number().int().positive().max(100).default(20);

// User validators
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, "First name is required").max(100),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: phoneSchema,
  locale: z.string().default("en"),
  theme: z.enum(["light", "dark", "system"]).default("light"),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: phoneSchema,
  locale: z.string().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  avatar: z.string().url().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Organization validators
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  slug: slugSchema,
  type: z.enum(["SHOP", "APPOINTMENT"]).default("SHOP"),
  capabilities: z.array(z.enum(["SHOP", "APPOINTMENT"])).max(2).optional(),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  logo: z.string().optional(),
  coverImage: z.string().optional(),
  image: z.string().optional(),
  locale: z.string().default("fa").optional(),
  timezone: z.string().default("Asia/Tehran").optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  logo: z.string().max(500).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// Business Hours validators
export const businessHoursSchema = z.array(
  z.object({
    day: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
    openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"),
    isOpen: z.boolean().default(true),
  })
);

// Service Category validators
export const createServiceCategorySchema = z.object({
  name: z.string().min(2, "Name is required").max(200),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(5000).optional(),
  image: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateServiceCategorySchema = createServiceCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Service validators
export const createServiceSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive(),
  duration: z.number().int().positive().max(1440),
  image: z.string().max(500).nullable().optional(),
  categoryId: z.string().cuid(),
  serviceProviderId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Appointment validators
export const createAppointmentSchema = z.object({
  serviceId: z.string().cuid(),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  notes: z.string().max(2000).optional(),
  // Customer details for guest booking
  customerName: z.string().min(2, "Name is required").max(200).optional(),
  customerPhone: z.string().min(10, "Phone number is required").max(20).optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
});

export const updateAppointmentSchema = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
  notes: z.string().max(2000).optional(),
  cancellationReason: z.string().max(1000).optional(),
});
// Product Category validators
export const createProductCategorySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(5000).optional(),
  image: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateProductCategorySchema = createProductCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

const image = z.object({
  url: z.string().url(),
  description: z.string().max(5000).optional(),
});
// Product validators
export const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(5000).optional(),
  basePrice: z.number().nonnegative(),
  image: z.string().max(500).nullable().optional(),
  sku: z.string().max(100).optional(),
  categoryId: z.string().cuid(),
  organizationId: z.string().cuid().optional(),
  organizationSlug: z.string().optional(),
  trackInventory: z.boolean().default(true),
  lowStockThreshold: z.number().int().nonnegative().default(10),
  sortOrder: z.number().int().default(0),
  discountType: z.enum(["none", "percentage", "fixed"]).default("none"),
  discountValue: z.number().nonnegative().default(0),
  preparationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Product Variant validators
export const createProductVariantSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().nonnegative().optional(),
  inventory: z.number().int().nonnegative().default(0),
  allowBackOrder: z.boolean().default(false),
});

export const updateProductVariantSchema = createProductVariantSchema.partial().extend({
  id: z.string().cuid(),
});
// Cart validators
export const addToCartSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().positive().max(999),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(999),
});

// Order validators
export const createOrderSchema = z.object({
  organizationSlug: z.string(),
  type: z.enum(["DELIVERY", "PICK_UP"]),
  customerName: z.string().max(100).optional(),
  //customerPhone: z.string().max(100).optional(),
  customerPhone: phoneSchema.optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  notes: z.string().max(2000).optional(),
  promotionCode: z.string().optional(),
  autoCompleteEndTimes: z.boolean().default(true),
  paymentMethod: z
    .enum(["CREDIT_CARD", "DEBIT_CARD", "CASH", "WALLET", "BANK_TRANSFER"])
    .optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "CANCELLED", "RECEIVED", "REFUNDED"]),
});

export const updateOrderEstimatedEndTimeSchema = z.object({
  type: z.enum(["PREPARATION", "PICK_UP", "DELIVERY"]),
  estimatedEndTime: z.string().datetime(),
});

export const updateOrderPaymentSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]),
  paymentId: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

// Review validators
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  organizationId: z.string().cuid(),
});

// Promotion validators
export const createPromotionSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  description: z.string().max(500).optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  startsAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const updatePromotionSchema = createPromotionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Organization Settings validators
export const updateOrganizationSettingsSchema = z.object({
  currency: z.string().default("IRR"),
  dateFormat: z.string().default("YYYY-MM-DD"),
  timeFormat: z.enum(["12h", "24h"]).default("24h"),
  minimumOrderAmount: z.number().nonnegative().optional(),
  maximumOrderAmount: z.number().nonnegative().optional(),
  deliveryRadius: z.number().positive().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  enablePickup: z.boolean().default(true),
  enableDelivery: z.boolean().default(true),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  settings: z.any().optional(),
  defaultPreparationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
});

export const updatePreparationDefaultsSchema = z.object({
  defaultPreparationMinutes: z.coerce.number().int().min(1).max(1440),
});

export const updatePaymentSettingsSchema = z.object({
  cardOwnerName: z.string().trim().max(200).nullable().optional(),
  cardNumber: z.string().trim().max(32).nullable().optional(),
  paymentCondition: z.boolean().default(false),
  paymentMethodInt: z.coerce.number().int().min(0).max(2).default(0),
  settings: z.any().optional(),
});

export const updateBookingSettingsSchema = z.object({
  slotDuration: z.coerce.number().int().positive().max(1440).optional(),
  bufferBefore: z.coerce.number().int().min(0).max(1440).optional(),
  bufferAfter: z.coerce.number().int().min(0).max(1440).optional(),
  minBookingNotice: z.coerce.number().int().min(0).max(525600).optional(),
  maxBookingAdvance: z.coerce.number().int().positive().max(1051200).optional(),
  maxAppointmentsPerDay: z.coerce.number().int().positive().max(1000).nullable().optional(),
  allowCancellation: z.boolean().optional(),
  cancellationDeadline: z.coerce.number().int().min(0).max(525600).optional(),
  requirePhone: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  requireName: z.boolean().optional(),
  autoConfirm: z.boolean().optional(),
});

// AI Media validators
export const createAiMediaJobSchema = z.object({
  count: z.number().int().min(1).max(6).default(3),
  aspect_ratio: z.string().default("1:1"),
  style_preset: z.string().default("LIGHT_MENU_PHOTO"),
  seller_prompt: z.string().max(1000).optional().nullable(),
  idempotency_key: z.string().trim().min(8).max(160).optional(),
});

export const selectAiMediaImageSchema = z.object({
  job_id: z.string().min(1).optional(),
  image_url: z.string().url(),
  output_index: z.number().int().min(0),
});

// Pagination and filtering
export const paginationSchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createCreativeStudioJobSchema = z.object({
  organizationId: z.string().cuid().optional(),
  targetType: z.enum(["PRODUCT", "CAMPAIGN", "FANPAGE_POST", "ORGANIZATION_BRAND", "IMPORTED_MEDIA"]),
  targetId: z.string().cuid().optional().nullable(),
  assetType: z.enum(["PRODUCT_IMAGE", "CAMPAIGN_IMAGE", "FANPAGE_IMAGE", "LOGO", "COVER", "OG_IMAGE", "IMPORT_MEDIA"]),
  prompt: z.string().trim().max(1000).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  count: z.number().int().min(1).max(4).default(1),
  aspect_ratio: z.string().trim().max(20).default("1:1"),
  style_preset: z.string().trim().max(80).default("LIGHT_MENU_PHOTO"),
  idempotency_key: z.string().trim().min(8).max(160).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((input, context) => {
  if (input.targetType === "PRODUCT" && input.assetType === "PRODUCT_IMAGE") {
    if (!input.targetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetId"],
        message: "Product target is required for Creative Studio product image generation",
      });
    }
    return;
  }

  if (input.targetType === "ORGANIZATION_BRAND") {
    if (!["LOGO", "COVER"].includes(input.assetType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetType"],
        message: "Organization brand Creative Studio jobs only support logo or cover assets",
      });
    }
    return;
  }
});

export const executeOrganizationBrandProviderSchema = z.object({
  organizationId: z.string().cuid().optional(),
  assetType: z.enum(["LOGO", "COVER"]),
  prompt: z.string().trim().max(1000).optional().nullable(),
  locale: z.enum(["fa", "en", "ar"]).default("fa"),
  dryRun: z.boolean().optional(),
  count: z.number().int().min(1).max(4).default(1),
  style_preset: z.string().trim().max(80).default("BRAND_CLEAN"),
});

export const creativeStudioJobFilterSchema = z.object({
  organizationId: z.string().cuid().optional(),
  status: z.enum(["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELED"]).optional(),
}).merge(paginationSchema);

export const creativeStudioApplyTargetFieldSchema = z.enum([
  "product.image",
  "organization.logo",
  "organization.coverImage",
  "fanpagePost.image",
]);

export const applyCreativeStudioAssetSchema = z.object({
  organizationId: z.string().cuid().optional(),
  applyToTarget: z.boolean().default(false),
  targetField: creativeStudioApplyTargetFieldSchema.optional(),
  confirmationText: z.string().trim().max(80).optional(),
  confirmed: z.boolean().optional(),
}).superRefine((input, context) => {
  if (!input.applyToTarget) return;

  if (!input.targetField) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetField"],
      message: "Target field is required when applying a Creative Studio asset",
    });
  }

  if (input.confirmed !== true && input.confirmationText !== "اعمال شود") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmationText"],
      message: "Confirmation text is required when applying a Creative Studio asset",
    });
  }
});

export const selectCreativeStudioAssetSchema = z.object({
  organizationId: z.string().cuid().optional(),
  targetField: creativeStudioApplyTargetFieldSchema.optional(),
});

export const organizationFilterSchema = z.object({
  type: z.enum(["SHOP", "APPOINTMENT"]).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
}).merge(paginationSchema);

export const productFilterSchema = z.object({
  categoryId: z.string().cuid().optional(),
  organizationId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  inStock: z.boolean().optional(),
}).merge(paginationSchema);

export const orderFilterSchema = z.object({
  status: z.enum(["PENDING", "PLACED", "ACCEPTED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "CANCELLED", "RECEIVED", "REFUNDED"]).optional(),
  type: z.enum(["DELIVERY", "PICK_UP"]).optional(),
  organizationId: z.string().cuid().optional(),
  driverId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
}).merge(paginationSchema);

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateOrderPaymentInput = z.infer<typeof updateOrderPaymentSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>;
export type UpdateBookingSettingsInput = z.infer<typeof updateBookingSettingsSchema>;
export type CreateAiMediaJobInput = z.infer<typeof createAiMediaJobSchema>;
export type SelectAiMediaImageInput = z.infer<typeof selectAiMediaImageSchema>;
export type CreateCreativeStudioJobInput = z.infer<typeof createCreativeStudioJobSchema>;
export type CreativeStudioJobFilterInput = z.infer<typeof creativeStudioJobFilterSchema>;
export type ApplyCreativeStudioAssetInput = z.infer<typeof applyCreativeStudioAssetSchema>;
export type SelectCreativeStudioAssetInput = z.infer<typeof selectCreativeStudioAssetSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
