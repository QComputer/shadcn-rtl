import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { jsonError, requireAuthSession } from "@/lib/api-guards"
import { notificationPreferencesService } from "@/lib/services/notification-preferences.service"

const organizationSlugSchema = z.string().trim().min(1)
const channelSchema = z.enum(["IN_APP", "WEB_PUSH", "SMS"])
const quietHourSchema = z.string().trim().regex(/^\d{2}:\d{2}$/).nullable().optional()

const preferenceSchema = z.object({
  channel: channelSchema,
  marketingEnabled: z.boolean().optional(),
  transactionalEnabled: z.boolean().optional(),
  quietHoursStart: quietHourSchema,
  quietHoursEnd: quietHourSchema,
})

const updatePreferencesSchema = z.object({
  organizationSlug: organizationSlugSchema,
  locale: z.string().trim().min(2).max(8).optional(),
  preferences: z.array(preferenceSchema).min(1).max(3),
})

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const organizationSlug = organizationSlugSchema.parse(request.nextUrl.searchParams.get("organizationSlug"))
    const preferences = await notificationPreferencesService.getCustomerPreferences(organizationSlug, session.user.id)
    return NextResponse.json({ preferences })
  } catch (error) {
    return jsonError(error, "Error loading notification preferences")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const body = updatePreferencesSchema.parse(await request.json())

    const preferences = await Promise.all(
      body.preferences.map((preference) =>
        notificationPreferencesService.upsertCustomerPreference({
          organizationSlug: body.organizationSlug,
          customerId: session.user.id,
          channel: preference.channel,
          marketingEnabled: preference.marketingEnabled,
          transactionalEnabled: preference.transactionalEnabled,
          quietHoursStart: preference.quietHoursStart,
          quietHoursEnd: preference.quietHoursEnd,
          locale: body.locale || session.user.locale || "fa",
          source: "PUBLIC_SHOP",
        }),
      ),
    )

    return NextResponse.json({ preferences })
  } catch (error) {
    return jsonError(error, "Error saving notification preferences")
  }
}
