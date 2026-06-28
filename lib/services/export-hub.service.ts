import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import type { CreateExportJobInput, ExportJobListOptions } from "@/lib/export-hub/types"
import type { ExportDataType, Prisma } from "@prisma/client"

type ExportPayload = {
  columns: string[]
  rows: Record<string, unknown>[]
  generatedAt: string
  csv?: string
}

const exportJobInclude = {
  organization: {
    select: { id: true, name: true, slug: true, type: true },
  },
  requestedBy: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.ExportJobInclude

function serializeValue(value: unknown): unknown {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object" && "toString" in value && value.constructor?.name === "Decimal") {
    return value.toString()
  }
  return value
}

function toRow(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, serializeValue(value)]))
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "")
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]) {
  return [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")),
  ].join("\n")
}

function filenameFor(type: ExportDataType, format: "CSV" | "JSON", organizationSlug: string) {
  const extension = format === "CSV" ? "csv" : "json"
  return `${organizationSlug}-${type.toLowerCase()}-export.${extension}`
}

export class ExportHubService {
  async listJobs(options: ExportJobListOptions = {}) {
    return prisma.exportJob.findMany({
      where: {
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(options.take ?? 40, 1), 100),
      include: exportJobInclude,
    })
  }

  async getJob(jobId: string, organizationId?: string | null) {
    const job = await prisma.exportJob.findFirst({
      where: {
        id: jobId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: exportJobInclude,
    })

    if (!job) throw new ApiError(404, "Export job not found")
    return job
  }

  async getJobOrganizationId(jobId: string) {
    const job = await prisma.exportJob.findUnique({
      where: { id: jobId },
      select: { organizationId: true },
    })

    if (!job) throw new ApiError(404, "Export job not found")
    return job.organizationId
  }

  async createJob(input: CreateExportJobInput) {
    const organization = await prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, slug: true },
    })
    if (!organization) throw new ApiError(404, "Organization not found")

    const payload = await this.buildPayload(input.organizationId, organization.slug, input.type, input.format)
    const completedAt = new Date()
    const job = await prisma.exportJob.create({
      data: {
        organizationId: organization.id,
        type: input.type,
        format: input.format,
        status: "COMPLETED",
        fileName: filenameFor(input.type, input.format, organization.slug),
        mimeType: input.format === "CSV" ? "text/csv" : "application/json",
        payload: payload as unknown as Prisma.InputJsonObject,
        rowCount: payload.rows.length,
        requestedByUserId: input.actorUserId,
        completedAt,
      },
      include: exportJobInclude,
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "ExportJob",
      entityId: job.id,
      description: "Export Hub job generated",
      newValue: {
        organizationId: organization.id,
        type: input.type,
        format: input.format,
        status: job.status,
        rowCount: job.rowCount,
        fileName: job.fileName,
      },
      userId: input.actorUserId,
      organizationId: organization.id,
    })

    return job
  }

  private async buildPayload(
    organizationId: string,
    organizationSlug: string,
    type: ExportDataType,
    format: "CSV" | "JSON",
  ): Promise<ExportPayload> {
    const generatedAt = new Date().toISOString()
    const rows = await this.loadRows(organizationId, organizationSlug, type)
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    const payload: ExportPayload = { columns, rows, generatedAt }
    if (format === "CSV") payload.csv = rowsToCsv(columns, rows)
    return payload
  }

  private async loadRows(organizationId: string, organizationSlug: string, type: ExportDataType) {
    if (type === "PRODUCTS") {
      const products = await prisma.product.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          basePrice: true,
          image: true,
          isActive: true,
          categoryId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return products.map(toRow)
    }

    if (type === "PRODUCT_CATEGORIES") {
      const categories = await prisma.productCategory.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 1000,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          sortOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return categories.map(toRow)
    }

    if (type === "ORDERS") {
      const orders = await prisma.order.findMany({
        where: { organizationSlug, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: {
          id: true,
          orderNumber: true,
          type: true,
          status: true,
          subtotal: true,
          deliveryFee: true,
          tax: true,
          discount: true,
          total: true,
          paymentStatus: true,
          paymentMethod: true,
          customerId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return orders.map(toRow)
    }

    if (type === "CUSTOMERS") {
      const members = await prisma.customerClubMembership.findMany({
        where: { organizationId },
        orderBy: { joinedAt: "desc" },
        take: 1000,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              locale: true,
            },
          },
        },
      })
      return members.map((member) => toRow({
        id: member.id,
        customerId: member.customerId,
        customerName: member.customer.name,
        customerEmail: member.customer.email,
        customerPhone: member.customer.phone,
        customerLocale: member.customer.locale,
        status: member.status,
        tier: member.tier,
        source: member.source,
        joinedAt: member.joinedAt,
        leftAt: member.leftAt,
      }))
    }

    if (type === "FANPAGE_POSTS") {
      const posts = await prisma.fanpagePost.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: {
          id: true,
          title: true,
          body: true,
          image: true,
          video: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return posts.map(toRow)
    }

    throw new ApiError(400, "Unsupported export data type")
  }
}

export const exportHubService = new ExportHubService()
