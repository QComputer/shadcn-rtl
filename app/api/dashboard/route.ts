import { NextRequest, NextResponse } from "next/server";
import { AppointmentStatus, OrderStatus, OrganizationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession } from "@/lib/api-guards";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatName(entity?: { name?: string | null; firstName?: string | null; lastName?: string | null } | null) {
  if (!entity) return "";
  return entity.name || [entity.firstName, entity.lastName].filter(Boolean).join(" ") || "";
}

function calculateDailyCounts<T extends { createdAt?: Date; date?: Date; total?: unknown; status?: string }>(items: T[], dateField: "createdAt" | "date" = "createdAt") {
  const result: Array<{ date: string; count: number; total: number }> = [];
  const today = startOfToday();

  for (let i = 6; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const key = day.toISOString().slice(0, 10);
    const dayItems = items.filter((item) => {
      const value = item[dateField];
      return value instanceof Date && value.toISOString().slice(0, 10) === key;
    });

    result.push({
      date: key,
      count: dayItems.length,
      total: dayItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
    });
  }

  return result;
}

async function getActiveMembershipForSession(userId: string, organizationId?: string | null) {
  return prisma.organizationMember.findFirst({
    where: {
      userId,
      isActive: true,
      organization: {
        isActive: true,
        deletedAt: null,
      },
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
    },
  });
}

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const userRole = session.user.role;
    const membership = await getActiveMembershipForSession(
      session.user.id,
      session.user.organizationId,
    );
    const organization = membership?.organization ?? null;

    let dashboardData;

    if (userRole === "SUPER_ADMIN") {
      dashboardData = await getSuperAdminDashboard();
    } else if ((userRole === "ADMIN" || userRole === "MANAGER") && organization) {
      dashboardData = organization.type === OrganizationType.SHOP
        ? await getShopDashboard(organization.id, organization.slug, organization.name)
        : await getAppointmentDashboard(organization.id, organization.name);
    } else if (userRole === "STAFF" && organization) {
      dashboardData = organization.type === OrganizationType.SHOP
        ? await getShopStaffDashboard(organization.slug, session.user.id)
        : await getAppointmentStaffDashboard(organization.id, session.user.id);
    } else if (userRole === "DRIVER") {
      dashboardData = await getDriverDashboard(session.user.id);
    } else {
      dashboardData = await getCustomerDashboard(session.user.id);
    }

    return NextResponse.json({
      ...dashboardData,
      userContext: {
        role: userRole,
        organizationType: organization?.type ?? null,
        organizationId: organization?.id ?? null,
        isTeamMember: Boolean(organization),
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch dashboard data");
  }
}

async function getSuperAdminDashboard() {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);

  const [
    totalOrganizations,
    totalUsers,
    totalOrders,
    totalAppointments,
    todayOrders,
    todayAppointments,
    ordersByStatus,
    organizationsByType,
    recentOrders,
    recentAppointments,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { isActive: true, deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.appointment.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null, createdAt: { gte: today, lt: tomorrow } } }),
    prisma.appointment.count({ where: { deletedAt: null, createdAt: { gte: today, lt: tomorrow } } }),
    prisma.order.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { status: true } }),
    prisma.organization.groupBy({ by: ["type"], where: { deletedAt: null }, _count: { type: true } }),
    prisma.order.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, firstName: true, lastName: true } },
        guestCustomer: { select: { name: true, firstName: true, lastName: true } },
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, firstName: true, lastName: true } },
        guestCustomer: { select: { name: true, firstName: true, lastName: true } },
        service: { select: { name: true, serviceProvider: { select: { name: true, firstName: true, lastName: true } } } },
      },
    }),
  ]);

  return {
    title: "پنل مدیریت سوپر ادمین",
    stats: { totalOrganizations, totalUsers, totalOrders, totalAppointments, todayOrders, todayAppointments },
    ordersByStatus: ordersByStatus.map((item) => ({ status: item.status, count: item._count.status })),
    organizationsByType: organizationsByType.map((item) => ({ type: item.type, count: item._count.type })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: formatName(order.customer) || formatName(order.guestCustomer),
      organization: order.organization.name,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    })),
    recentAppointments: recentAppointments.map((appointment) => ({
      id: appointment.id,
      customer: formatName(appointment.customer) || formatName(appointment.guestCustomer),
      service: appointment.service.name,
      provider: formatName(appointment.service.serviceProvider),
      status: appointment.status,
      date: appointment.date,
      createdAt: appointment.createdAt,
    })),
  };
}

async function getShopDashboard(organizationId: string, organizationSlug: string, organizationName: string) {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -7);

  const [
    totalOrders,
    totalProducts,
    totalCustomers,
    totalMembers,
    pendingOrders,
    acceptedOrders,
    preparingOrders,
    readyOrders,
    completedOrders,
    cancelledOrders,
    todayOrders,
    todayRevenue,
    weeklyOrders,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { organizationSlug, deletedAt: null } }),
    prisma.product.count({ where: { organizationSlug, deletedAt: null } }),
    prisma.order.groupBy({ by: ["customerId"], where: { organizationSlug, deletedAt: null, customerId: { not: null } }, _count: { customerId: true } }),
    prisma.organizationMember.count({ where: { organizationId, organizationSlug, isActive: true } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, status: { in: [OrderStatus.PENDING, OrderStatus.PLACED] } } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, status: OrderStatus.ACCEPTED } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, status: OrderStatus.PREPARING } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, status: { in: [OrderStatus.READY, OrderStatus.PICKED_UP] } } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, status: { in: [OrderStatus.DELIVERED, OrderStatus.RECEIVED] } } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, status: OrderStatus.CANCELLED } }),
    prisma.order.count({ where: { organizationSlug, deletedAt: null, createdAt: { gte: today, lt: tomorrow } } }),
    prisma.order.aggregate({ where: { organizationSlug, deletedAt: null, createdAt: { gte: today, lt: tomorrow }, status: { in: [OrderStatus.DELIVERED, OrderStatus.RECEIVED] } }, _sum: { total: true } }),
    prisma.order.findMany({ where: { organizationSlug, deletedAt: null, createdAt: { gte: weekAgo } }, select: { createdAt: true, total: true, status: true }, orderBy: { createdAt: "asc" } }),
    prisma.order.findMany({
      where: { organizationSlug, deletedAt: null },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, firstName: true, lastName: true, phone: true } },
        guestCustomer: { select: { name: true, firstName: true, lastName: true, phone: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return {
    title: `پنل مدیریت ${organizationName || "فروشگاه"}`,
    organizationType: "SHOP",
    stats: { totalOrders, totalProducts, totalCustomers: totalCustomers.length, totalMembers, pendingOrders, acceptedOrders, preparingOrders, readyOrders, completedOrders, cancelledOrders, todayOrders, todayRevenue: todayRevenue._sum.total || 0 },
    salesData: calculateDailyCounts(weeklyOrders),
    ordersByStatus: [
      { status: "PENDING", label: "جدید", count: pendingOrders, color: "#3b82f6" },
      { status: "ACCEPTED", label: "قبول شده", count: acceptedOrders, color: "#f5940b" },
      { status: "PREPARING", label: "در حال آماده‌سازی", count: preparingOrders, color: "#edf50b" },
      { status: "READY", label: "آماده", count: readyOrders, color: "#25c522" },
      { status: "DELIVERED", label: "تحویل شده", count: completedOrders, color: "#2e76d4" },
      { status: "CANCELLED", label: "لغو شده", count: cancelledOrders, color: "#ef4444" },
    ],
    recentOrders: recentOrders.map((order) => ({ id: order.id, orderNumber: order.orderNumber, customer: formatName(order.customer) || formatName(order.guestCustomer), phone: order.customer?.phone || order.guestCustomer?.phone, items: order._count.items, total: order.total, status: order.status, createdAt: order.createdAt })),
  };
}

async function getAppointmentDashboard(organizationId: string, organizationName: string) {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -7);
  const appointmentWhere = { deletedAt: null, service: { organizationId, deletedAt: null } };

  const [totalAppointments, totalServices, totalServiceCategories, totalMembers, pendingAppointments, confirmedAppointments, completedAppointments, cancelledAppointments, todayAppointments, weeklyAppointments, recentAppointments] = await Promise.all([
    prisma.appointment.count({ where: appointmentWhere }),
    prisma.service.count({ where: { organizationId, deletedAt: null } }),
    prisma.serviceCategory.count({ where: { organizationId, deletedAt: null } }),
    prisma.organizationMember.count({ where: { organizationId, isActive: true } }),
    prisma.appointment.count({ where: { ...appointmentWhere, status: AppointmentStatus.PENDING } }),
    prisma.appointment.count({ where: { ...appointmentWhere, status: AppointmentStatus.CONFIRMED } }),
    prisma.appointment.count({ where: { ...appointmentWhere, status: AppointmentStatus.COMPLETED } }),
    prisma.appointment.count({ where: { ...appointmentWhere, status: AppointmentStatus.CANCELLED } }),
    prisma.appointment.findMany({ where: { ...appointmentWhere, date: { gte: today, lt: tomorrow } }, include: { customer: { select: { name: true, firstName: true, lastName: true } }, guestCustomer: { select: { name: true, firstName: true, lastName: true } }, service: { select: { name: true, duration: true, serviceProvider: { select: { name: true, firstName: true, lastName: true } } } } }, orderBy: { date: "asc" } }),
    prisma.appointment.findMany({ where: { ...appointmentWhere, date: { gte: weekAgo } }, select: { date: true, status: true }, orderBy: { date: "asc" } }),
    prisma.appointment.findMany({ where: appointmentWhere, take: 10, orderBy: { createdAt: "desc" }, include: { customer: { select: { name: true, firstName: true, lastName: true, phone: true } }, guestCustomer: { select: { name: true, firstName: true, lastName: true, phone: true } }, service: { select: { name: true, duration: true, serviceProvider: { select: { name: true, firstName: true, lastName: true } } } } } }),
  ]);

  return {
    title: `پنل مدیریت ${organizationName || "نوبت‌دهی"}`,
    organizationType: "APPOINTMENT",
    stats: { totalAppointments, totalServices, totalServiceCategories, totalMembers, pendingAppointments, confirmedAppointments, completedAppointments, cancelledAppointments, todayAppointments: todayAppointments.length },
    appointmentsData: calculateDailyCounts(weeklyAppointments, "date"),
    appointmentsByStatus: [
      { status: "PENDING", label: "در انتظار", count: pendingAppointments, color: "#f59e0b" },
      { status: "CONFIRMED", label: "تأیید شده", count: confirmedAppointments, color: "#3b82f6" },
      { status: "COMPLETED", label: "انجام شده", count: completedAppointments, color: "#10b981" },
      { status: "CANCELLED", label: "لغو شده", count: cancelledAppointments, color: "#ef4444" },
    ],
    todaySchedule: todayAppointments.map((appointment) => ({ id: appointment.id, customer: formatName(appointment.customer) || formatName(appointment.guestCustomer), service: appointment.service.name, provider: formatName(appointment.service.serviceProvider), date: appointment.date, startTime: appointment.startTime, endTime: appointment.endTime, status: appointment.status })),
    recentAppointments: recentAppointments.map((appointment) => ({ id: appointment.id, customer: formatName(appointment.customer) || formatName(appointment.guestCustomer), phone: appointment.customer?.phone || appointment.guestCustomer?.phone, service: appointment.service.name, provider: formatName(appointment.service.serviceProvider), status: appointment.status, date: appointment.date, createdAt: appointment.createdAt })),
  };
}

async function getShopStaffDashboard(organizationSlug: string, userId: string) {
  const [assignedOrders, recentOrders] = await Promise.all([
    prisma.order.count({ where: { organizationSlug, deletedAt: null, driverId: userId } }),
    prisma.order.findMany({ where: { organizationSlug, deletedAt: null }, take: 5, orderBy: { createdAt: "desc" } }),
  ]);
  return { title: "پنل کارکنان فروشگاه", organizationType: "SHOP", stats: { assignedOrders }, recentOrders };
}

async function getAppointmentStaffDashboard(organizationId: string, userId: string) {
  const appointments = await prisma.appointment.findMany({
    where: { deletedAt: null, service: { organizationId, serviceProviderId: userId, deletedAt: null } },
    take: 10,
    orderBy: { startTime: "asc" },
    include: { service: { select: { name: true } }, customer: { select: { name: true, firstName: true, lastName: true } }, guestCustomer: { select: { name: true, firstName: true, lastName: true } } },
  });
  return { title: "پنل کارکنان نوبت‌دهی", organizationType: "APPOINTMENT", stats: { upcomingAppointments: appointments.length }, todaySchedule: appointments.map((appointment) => ({ id: appointment.id, customer: formatName(appointment.customer) || formatName(appointment.guestCustomer), service: appointment.service.name, status: appointment.status, date: appointment.date })) };
}

async function getDriverDashboard(userId: string) {
  const orders = await prisma.order.findMany({ where: { deletedAt: null, driverId: userId }, take: 10, orderBy: { createdAt: "desc" } });
  return { title: "پنل راننده", organizationType: "DELIVERY", stats: { assignedOrders: orders.length }, recentOrders: orders };
}

async function getCustomerDashboard(userId: string) {
  const [orders, appointments] = await Promise.all([
    prisma.order.findMany({ where: { deletedAt: null, customerId: userId }, take: 5, orderBy: { createdAt: "desc" } }),
    prisma.appointment.findMany({ where: { deletedAt: null, customerId: userId }, take: 5, orderBy: { date: "desc" }, include: { service: { select: { name: true } } } }),
  ]);
  return { title: "پنل کاربر", stats: { totalOrders: orders.length, totalAppointments: appointments.length }, recentOrders: orders, recentAppointments: appointments };
}
