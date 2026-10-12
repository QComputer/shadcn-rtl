-- Keep this enum change isolated so later migrations use the new value only
-- after PostgreSQL has committed it. This change grants no capability rows.
ALTER TYPE "OrganizationCapabilityKey" ADD VALUE 'HOTEL_WEBSITE';
