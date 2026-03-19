// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, OrganizationType, OrderStatus, AppointmentStatus, User } from "@prisma/client";

/**
 * Dashboard Statistics API
 * 
 * Returns role-appropriate dashboard data based on the authenticated user's role:
 * - SUPER_ADMIN: All organizations statistics
 * - ADMIN/MANAGER (SHOP): Shop-specific orders, products, customers
 * - ADMIN/MANAGER (APPOINTMENT): Appointment-specific services, appointments
 * - STAFF: Limited to their assigned data
 * - DRIVER: Assigned delivery orders
 * - CUSTOMER: Their own orders and appointments
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const userRole = user.role as UserRole;
    const isTeamMember = user.isTeamMember ?? false;
    const organizationId = user.organizationId as string | null;

    // Get organization membership details
    let organizationType: OrganizationType | null = null;
    let orgMemberRole: string | null = null;

    if (organizationId) {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: user.id },
        include: {
          organization: {
            select: {
              type: true,
              name: true,
              slug: true,
            },
          },
        },
      });
      // TODO: check user.organizationId == membership.organization.id
      if (membership) {
        organizationType = membership.organization.type;
      }
    }

    // Build dashboard data based on role
    let dashboardData;

    switch (userRole) {
      case "SUPER_ADMIN":
        dashboardData = await getSuperAdminDashboard();
        break;

      case "ADMIN":
      case "MANAGER":
        if (isTeamMember && organizationId && organizationType) {
          if (organizationType === OrganizationType.SHOP) {
            dashboardData = await getShopDashboard(organizationId);
          } else {
            dashboardData = await getAppointmentDashboard(organizationId);
          }
        } else {
          dashboardData = await getDefaultDashboard(user.id!);
        }
        break;

      case "STAFF":
        if (isTeamMember && organizationId && organizationType) {
          if (organizationType === OrganizationType.SHOP) {
            dashboardData = await getShopStaffDashboard(organizationId, user.id!);
          } else {
            dashboardData = await getAppointmentStaffDashboard(organizationId, user.id!);
          }
        } else {
          dashboardData = await getDefaultDashboard(user.id!);
        }
        break;

      case "DRIVER":
        dashboardData = await getDriverDashboard(user.id!);
        break;

      case "CUSTOMER":
      default:
        dashboardData = await getCustomerDashboard(user.id!);
        break;
    }

    // Add user context to response
    return NextResponse.json({
      ...dashboardData,
      userContext: {
        role: userRole,
        organizationType,
        organizationId,
        isTeamMember,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * SUPER_ADMIN Dashboard - All organizations data
 */
async function getSuperAdminDashboard() {
  // Get all organizations count
  const [
    totalOrganizations,
    totalUsers,
    totalOrders,
    totalAppointments,
    recentOrders,
    recentAppointments,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.appointment.count(),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, firstName: true, lastName: true } },
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.appointment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, firstName: true, lastName: true } },
        service: { select: { name: true, serviceProvider: {
          select: { name: true, firstName: true, lastName: true },
        }, } },
        
      },
    }),
  ]);

  // Get today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayOrders, todayAppointments] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.appointment.count({
      where: { createdAt: { gte: today, lt: tomorrow } },
    }),
  ]);

  // Get orders by status
  const ordersByStatus = await prisma.order.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  // Get organizations by type
  const organizationsByType = await prisma.organization.groupBy({
    by: ["type"],
    _count: { type: true },
  });

  return {
    title: "پنل مدیریت سوپر ادمین",
    stats: {
      totalOrganizations,
      totalUsers,
      totalOrders,
      totalAppointments,
      todayOrders,
      todayAppointments,
    },
    ordersByStatus: ordersByStatus.map((o) => ({
      status: o.status,
      count: o._count.status,
    })),
    organizationsByType: organizationsByType.map((o) => ({
      type: o.type,
      count: o._count.type,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: `${order.customer?.firstName} ${order.customer?.lastName}`,
      organization: order.organization.name,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    })),
    recentAppointments: recentAppointments.map((apt) => ({
      id: apt.id,
      customer: `${apt.customer.firstName} ${apt.customer.lastName}`,
      service: apt.service.name,
      provider: apt.serviceProvider ? `${apt.serviceProvider.firstName} ${apt.serviceProvider.lastName}` : null,
      status: apt.status,
      date: apt.date,
      createdAt: apt.createdAt,
    })),
  };
}

/**
 * SHOP Organization Dashboard (ADMIN/MANAGER)
 */
async function getShopDashboard(organizationId: string) {
  // Get organization details
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, slug: true },
  });

  // Get counts
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
  ] = await Promise.all([
    prisma.order.count({ where: { organizationId } }),
    prisma.product.count({ where: { organizationId } }),
    prisma.order.groupBy({
      by: ["customerId"],
      where: { organizationId },
      _count: { customerId: true },
    }),
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.order.count({
      where: {
        organizationId,
        status: { in: [OrderStatus.PENDING, OrderStatus.PLACED] },
      },
    }),
    prisma.order.count({
      where: { organizationId, status: OrderStatus.ACCEPTED },
    }),
    prisma.order.count({
      where: { organizationId, status: OrderStatus.PREPARING },
    }),
    prisma.order.count({
      where: {
        organizationId,
        status: { in: [OrderStatus.READY, OrderStatus.PICKED_UP] },
      },
    }),
    prisma.order.count({
      where: {
        organizationId,
        status: { in: [OrderStatus.DELIVERED, OrderStatus.RECEIVED] },
      },
    }),
    prisma.order.count({
      where: { organizationId, status: OrderStatus.CANCELLED },
    }),
  ]);

  // Get today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayOrders, todayRevenue] = await Promise.all([
    prisma.order.count({
      where: { organizationId, createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.order.aggregate({
      where: {
        organizationId,
        createdAt: { gte: today, lt: tomorrow },
        status: { in: [OrderStatus.DELIVERED, OrderStatus.RECEIVED] },
      },
      _sum: { total: true },
    }),
  ]);

  // Get weekly sales data
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklyOrders = await prisma.order.findMany({
    where: {
      organizationId,
      createdAt: { gte: weekAgo },
    },
    select: {
      createdAt: true,
      total: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Get recent orders
  const recentOrders = await prisma.order.findMany({
    where: { organizationId },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, firstName: true, lastName: true, phone: true } },
    },
  });

  // Calculate weekly sales by day
  const salesByDay = calculateWeeklySales(weeklyOrders);

  return {
    title: `پنل مدیریت ${organization?.name || "فروشگاه"}`,
    organizationType: "SHOP",
    stats: {
      totalOrders,
      totalProducts,
      totalCustomers: totalCustomers.length,
      totalMembers,
      totalMembers,
      pendingOrders,
      acceptedOrders,
      preparingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      todayOrders,
      todayRevenue: todayRevenue._sum.total || 0,
    },
    salesData: salesByDay,
    ordersByStatus: [
      {
        status: "PENDING",
        label: "جدید",
        count: pendingOrders,
        color: "#3b82f6",
      },
      {
        status: "ACCEPTED",
        label: "قبول شده",
        count: acceptedOrders,
        color: "#f5940b",
      },
      {
        status: "PREPARING",
        label: "در حال آماده‌سازی",
        count: preparingOrders,
        color: "#edf50b",
      },
      {
        status: "DELIVERED",
        label: "آماده شده",
        count: completedOrders,
        color: "#25c522",
      },
      {
        status: "COMPLETED",
        label: "کامل شده",
        count: completedOrders,
        color: "#2e76d4",
      },
      {
        status: "CANCELLED",
        label: "لغو شده",
        count: cancelledOrders,
        color: "#ef4444",
      },
    ],
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customer?.name,
      phone: order.customer?.phone,
      items: order.items?.length || 0,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    })),
  };
}

/**
 * APPOINTMENT Organization Dashboard (ADMIN/MANAGER)
 */
async function getAppointmentDashboard(organizationId: string) {
  // Get organization details
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, slug: true },
  });

  // Get counts
  const [
    totalAppointments,
    totalServices,
    totalServiceCategories,
    totalMembers,
    pendingAppointments,
    confirmedAppointments,
    completedAppointments,
    cancelledAppointments,
  ] = await Promise.all([
    prisma.appointment.count({ where: { service: { organizationId } } }),
    prisma.service.count({ where: { organizationId } }),
    prisma.serviceCategory.count({ where: { organizationId } }),
    prisma.organizationMember.count({ where: { organizationId } }),
    prisma.appointment.count({
      where: { service: { organizationId }, status: AppointmentStatus.PENDING },
    }),
    prisma.appointment.count({
      where: {  service: { organizationId }, status: AppointmentStatus.CONFIRMED },
    }),
    prisma.appointment.count({
      where: {  service: { organizationId }, status: AppointmentStatus.COMPLETED },
    }),
    prisma.appointment.count({
      where: {  service: { organizationId }, status: AppointmentStatus.CANCELLED },
    }),
  ]);

  // Get today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayAppointments = await prisma.appointment.findMany({
    where: {
      service: { organizationId },
      date: { gte: today, lt: tomorrow },
    },
    include: {
      customer: { select: { name: true, firstName: true, lastName: true } },
      service: {
        select: { name: true, duration: true, serviceProvider: true },
      },
    },
    orderBy: { date: "asc" },
  });

  // Get weekly appointments
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weeklyAppointments = await prisma.appointment.findMany({
    where: {
      service: { organizationId },
      date: { gte: weekAgo },
    },
    select: {
      date: true,
      status: true,
    },
    orderBy: { date: "asc" },
  });

  // Get recent appointments
  const recentAppointments = await prisma.appointment.findMany({
    where: { service: { organizationId } },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: { name: true, firstName: true, lastName: true, phone: true },
      },
      service: {
        select: { name: true, duration: true, serviceProvider: true },
      },
    },
  });

  // Calculate weekly appointments by day
  const appointmentsByDay = calculateWeeklyAppointments(weeklyAppointments);

  return {
    title: `پنل مدیریت ${organization?.name || "سازمان"}`,
    organizationType: "APPOINTMENT",
    stats: {
      totalAppointments,
      totalServices,
      totalServiceCategories,
      totalMembers,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      todayAppointmentsCount: todayAppointments.length,
    },
    todayAppointments: todayAppointments.map((apt) => ({
      id: apt.id,
      customer: `${apt.customer.firstName} ${apt.customer.lastName}`,
      service: apt.service.name,
      provider: apt.serviceProvider ? `${apt.serviceProvider.firstName} ${apt.serviceProvider.lastName}` : null,
      time: apt.date,
      status: apt.status,
    })),
    appointmentsData: appointmentsByDay,
    appointmentsByStatus: [
      { status: "PENDING", label: "در انتظار", count: pendingAppointments, color: "#3b82f6" },
      { status: "CONFIRMED", label: "تأیید شده", count: confirmedAppointments, color: "#8b5cf6" },
      { status: "COMPLETED", label: "تکمیل شده", count: completedAppointments, color: "#22c55e" },
      { status: "CANCELLED", label: "لغو شده", count: cancelledAppointments, color: "#ef4444" },
    ],
    recentAppointments: recentAppointments.map((apt) => ({
      id: apt.id,
      customer: `${apt.customer.firstName} ${apt.customer.lastName}`,
      phone: apt.customer.phone,
      service: apt.service.name,
      provider: apt.serviceProvider ? `${apt.serviceProvider.firstName} ${apt.serviceProvider.lastName}` : null,
      date: apt.date,
      status: apt.status,
      createdAt: apt.createdAt,
    })),
  };
}

/**
 * SHOP Staff Dashboard
 */
async function getShopStaffDashboard(organizationId: string, userId: string) {
  // Staff can see orders but limited view
  const [totalOrders, pendingOrders, recentOrders] = await Promise.all([
    prisma.order.count({ where: { organizationId } }),
    prisma.order.count({ where: { organizationId, status: "PENDING" } }),
    prisma.order.findMany({
      where: { organizationId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    title: "پنل کارمند فروشگاه",
    organizationType: "SHOP",
    stats: {
      totalOrders,
      pendingOrders,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: `${order.customer.firstName} ${order.customer.lastName}`,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    })),
  };
}

/**
 * APPOINTMENT Staff Dashboard
 */
async function getAppointmentStaffDashboard(organizationId: string, userId: string) {
  // Staff see appointments assigned to them or their services
  const [
    myAppointments,
    pendingAppointments,
    completedAppointments,
    myTodayAppointments,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { service: { organizationId, serviceProviderId: userId } },
    }),
    prisma.appointment.count({
      where: {
        service: { organizationId, serviceProviderId: userId },
        status: "PENDING",
      },
    }),
    prisma.appointment.count({
      where: {
        service: { organizationId, serviceProviderId: userId },
        status: "COMPLETED",
      },
    }),
    prisma.appointment.findMany({
      where: {
        service: { organizationId, serviceProviderId: userId },
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      include: {
        customer: {
          select: { name: true, firstName: true, lastName: true, phone: true },
        },
        service: { select: { name: true, duration: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // Get recent appointments for this staff
  const recentAppointments = await prisma.appointment.findMany({
    where: { service: { organizationId, serviceProviderId: userId } },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
  });

  return {
    title: "پنل کارمند",
    organizationType: "APPOINTMENT",
    stats: {
      totalAppointments: myAppointments,
      pendingAppointments,
      completedAppointments,
      todayAppointmentsCount: myTodayAppointments.length,
    },
    todayAppointments: myTodayAppointments.map((apt) => ({
      id: apt.id,
      customer: `${apt.customer.firstName} ${apt.customer.lastName}`,
      phone: apt.customer.phone,
      service: apt.service.name,
      time: apt.date,
      status: apt.status,
    })),
    recentAppointments: recentAppointments.map((apt) => ({
      id: apt.id,
      customer: `${apt.customer.firstName} ${apt.customer.lastName}`,
      service: apt.service.name,
      date: apt.date,
      status: apt.status,
      createdAt: apt.createdAt,
    })),
  };
}

/**
 * DRIVER Dashboard
 */
async function getDriverDashboard(userId: string) {
  // Drivers see orders assigned to them
  const [
    totalAssignedOrders,
    pendingDeliveries,
    completedDeliveries,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { driverId: userId } }),
    prisma.order.count({ where: { driverId: userId, status: "PROCESSING" } }),
    prisma.order.count({ where: { driverId: userId, status: "DELIVERED" } }),
    prisma.order.findMany({
      where: { driverId: userId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { name: true, firstName: true, lastName: true, phone: true },
        },
        organization: { select: { name: true, phone: true } },
      },
    }),
  ]);

  return {
    title: "پنل راننده",
    stats: {
      totalAssignedOrders,
      pendingDeliveries,
      completedDeliveries,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: `${order.customer.firstName} ${order.customer.lastName}`,
      phone: order.customer.phone,
      address: order.deliveryAddress,
      organization: order.organization.name,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    })),
  };
}

/**
 * CUSTOMER Dashboard
 */
async function getCustomerDashboard(userId: string) {
  // Customers see their own orders and appointments
  const [
    totalOrders,
    pendingOrders,
    completedOrders,
    totalAppointments,
    pendingAppointments,
    completedAppointments,
    recentOrders,
    recentAppointments,
  ] = await Promise.all([
    prisma.order.count({ where: { customerId: userId } }),
    prisma.order.count({
      where: { customerId: userId, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.order.count({ where: { customerId: userId, status: "DELIVERED" } }),
    prisma.appointment.count({ where: { customerId: userId } }),
    prisma.appointment.count({
      where: { customerId: userId, status: { in: ["PENDING", "CONFIRMED"] } },
    }),
    prisma.appointment.count({
      where: { customerId: userId, status: "COMPLETED" },
    }),
    prisma.order.findMany({
      where: { customerId: userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { name: true, slug: true, logo: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { customerId: userId },
      take: 5,
      orderBy: { date: "desc" },
      include: {
        organization: { select: { name: true, slug: true, logo: true } },
        service: { select: { name: true, duration: true } },
        serviceProvider: {
          select: { name: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);

  // Calculate total spent
  const totalSpent = await prisma.order.aggregate({
    where: { customerId: userId, status: "DELIVERED" },
    _sum: { total: true },
  });

  return {
    title: "پنل مشتری",
    stats: {
      totalOrders,
      pendingOrders,
      completedOrders,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalSpent: totalSpent._sum.total || 0,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      organization: order.organization.name,
      organizationSlug: order.organization.slug,
      logo: order.organization.logo,
      items: order.items?.length || 0,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    })),
    recentAppointments: recentAppointments.map((apt) => ({
      id: apt.id,
      organization: apt.organization.name,
      organizationSlug: apt.organization.slug,
      logo: apt.organization.logo,
      service: apt.service.name,
      duration: apt.service.duration,
      provider: apt.serviceProvider ? `${apt.serviceProvider.firstName} ${apt.serviceProvider.lastName}` : null,
      date: apt.date,
      status: apt.status,
      createdAt: apt.createdAt,
    })),
  };
}

/**
 * Default Dashboard for unknown roles
 */
async function getDefaultDashboard(userId: string) {
  return {
    title: "پنل مدیریت",
    stats: {},
    recentOrders: [],
    recentAppointments: [],
  };
}

/**
 * Calculate weekly sales by day for SHOP
 */
function calculateWeeklySales(orders: { createdAt: Date; total: number; status: string }[]) {
  const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
  const salesByDay = days.map((name) => ({ name, sales: 0 }));

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday

  // Convert to Persian day format
  const persianDayOfWeek = (dayOfWeek + 1) % 7;

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const orderDayOfWeek = orderDate.getDay();
    const persianDay = (orderDayOfWeek + 1) % 7;

    // Only count delivered/completed orders
    if (order.status === "DELIVERED" || order.status === "COMPLETED") {
      salesByDay[persianDay].sales += Number(order.total);
    }
  });

  return salesByDay;
}

/**
 * Calculate weekly appointments by day for APPOINTMENT
 */
function calculateWeeklyAppointments(appointments: { date: Date; status: string }[]) {
  const days = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
  const appointmentsByDay = days.map((name) => ({ name, count: 0 }));

  appointments.forEach((apt) => {
    const aptDate = new Date(apt.date);
    const dayOfWeek = aptDate.getDay();
    const persianDay = (dayOfWeek + 1) % 7;

    appointmentsByDay[persianDay].count += 1;
  });

  return appointmentsByDay;
}
