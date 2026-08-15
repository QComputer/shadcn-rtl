export type ClientUser = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  image?: string | null;
  role?: string;
  locale?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
};

export type ClientGuestCustomer = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: unknown;
};

export type ClientOrganization = {
  id: string;
  name: string;
  slug?: string;
  type?: "SHOP" | "APPOINTMENT";
  capabilitiesInitializedAt?: string | null;
  capabilities?: Array<{
    key: "SHOP" | "APPOINTMENT";
    status: "ACTIVE" | "INACTIVE";
  }>;
  address?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  [key: string]: unknown;
};

export type ClientPaymentSettings = {
  id?: string;
  organizationId?: string;
  cardNumber?: string | null;
  cardOwnerName?: string | null;
  paymentMethod?: number | string | null;
  paymentMethodInt?: number | null;
  paymentCondition?: boolean | null;
  [key: string]: unknown;
};

export type ClientBusinessHour = {
  id?: string;
  dayOfWeek?: string;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed?: boolean;
  [key: string]: unknown;
};

export type ClientOrganizationSettings = {
  id?: string;
  organizationId?: string;
  theme?: string | null;
  locale?: string | null;
  defaultPreparationMinutes?: number;
  [key: string]: unknown;
};
