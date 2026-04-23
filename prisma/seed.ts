import { PrismaClient, OrganizationType, UserRole, AppointmentStatus, CartStatus, OrderType, OrderStatus, PaymentStatus, PaymentMethod, DayOfWeek } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {organizationService} from '@/lib/services/organization.service'

// Generate a unique sessionId
function generateSessionId(name: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `SESSION-${timestamp}-${name}`;
}
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...\n");

  // Clean existing data (in reverse order of dependencies)
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.guestCustomer.deleteMany();
  await prisma.shopCartItem.deleteMany();
  await prisma.shopCart.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.bookingSettings.deleteMany();
  await prisma.organizationSettings.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.location.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Cleaned existing data\n");

  // ========================================
  // 1. CREATE USERS - All Roles for Access Control Testing
  // ========================================
  console.log("👤 Creating users with all roles for access control testing...");

  const hashedPassword = await bcrypt.hash("123456", 12);

  const users = await Promise.all([
    // ========================================
    // SUPER_ADMIN (index 0)
    // Full access to all features, pages, and functionality
    // ========================================
    prisma.user.create({
      data: {
        // email is now optional
        password: hashedPassword,
        firstName: "احمد",
        lastName: "جمالی",
        name: "superadmin", // unique username
        phone: "+989100000001",
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // ========================================
    // SHOP Organization Users (indices 1-5)
    // ========================================

    // SHOP ADMIN (index 1)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        //email: "shop-admin@shop.ir", // optional
        password: hashedPassword,
        firstName: "مدیر",
        lastName: "فروشگاه",
        name: "shop-admin", // unique username
        phone: "+989100000002",
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP MANAGER (index 2)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        email: "shop-manager@shop.ir", // optional
        password: hashedPassword,
        firstName: "معاون",
        lastName: "فروشگاه",
        name: "shop-manager", // unique username
        phone: "+989100000003",
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP STAFF (index 3)
    // Access: dashboard, my orders (if also CUSTOMER), settings, calendar
    // Note: STAFF without ADMIN/MANAGER org role has limited access
    prisma.user.create({
      data: {
        email: "shop-staff@shop.ir", // optional
        password: hashedPassword,
        firstName: "کارمند",
        lastName: "فروشگاه",
        name: "shop-staff", // unique username
        phone: "+989100000004",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP DRIVER (index 4)
    // Access: dashboard, my orders, settings, calendar
    prisma.user.create({
      data: {
        password: hashedPassword,
        firstName: "راننده",
        lastName: "فروشگاه",
        name: "shop-driver", // unique username
        phone: "+989100000005",
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // ========================================
    // APPOINTMENT Organization Users (indices 5-9)
    // ========================================

    // APPOINTMENT ADMIN (index 5)
    // Access: dashboard, organization details, members, appointments, services, service categories, my-services/appointments
    prisma.user.create({
      data: {
        email: "fariba.farhadi@gmail.com", // optional
        password: hashedPassword,
        firstName: "فریبا",
        lastName: "فرهادی",
        name: "fariba", // unique username
        phone: "+989100000006",
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // APPOINTMENT MANAGER (index 6)
    // Access: dashboard, organization details, members, appointments, services, service categories, my-services/appointments
    prisma.user.create({
      data: {
        email: "appt-manager@clinic.ir", // optional
        password: hashedPassword,
        firstName: "سیمسن",
        lastName: "سیمین نژاد",
        name: "simin", // unique username
        phone: "+989100000007",
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // APPOINTMENT STAFF
    // Access: dashboard, my appointments, my services
    // Service Provider 1 - (index 7)
    prisma.user.create({
      data: {
        email: "appt-staff@clinic.ir", // optional
        password: hashedPassword,
        firstName: "نگار",
        lastName: "ضیا",
        name: "negar", // unique username
        phone: "+989100000008",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // Service Provider 2 -  (index 8)
    prisma.user.create({
      data: {
        email: "dr-derma@clinic.ir", // optional
        password: hashedPassword,
        firstName: "طاهره",
        lastName: "قربانی",
        name: "tahere", // unique username
        phone: "+989100000011",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // Service Provider 3 - (index 9)
    prisma.user.create({
      data: {
        email: "hairstylist@clinic.ir", // optional
        password: hashedPassword,
        firstName: "نرگس ",
        lastName: "ضیا",
        name: "narges", // unique username
        phone: "+989100000012",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // ========================================
    // CUSTOMER Users (indices 10-12)
    // ========================================

    // CUSTOMER 1 (index 10)
    // Access: dashboard, my orders, my appointments, settings, calendar
    prisma.user.create({
      data: {
        email: "customer1@example.com", // optional
        password: hashedPassword,
        firstName: "الهه",
        lastName: "فروغی",
        name: "eli", // unique username
        phone: "+989100000013",
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // CUSTOMER 2 (index 11)
    prisma.user.create({
      data: {
        email: "customer2@example.com", // optional
        password: hashedPassword,
        firstName: "مشتری",
        lastName: "دوم",
        name: "customer2", // unique username
        phone: "+989100000014",
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // CUSTOMER 3 (index 12)
    prisma.user.create({
      data: {
        // No email - demonstrating optional email
        password: hashedPassword,
        firstName: "مشتری",
        lastName: "سوم",
        name: "customer3", // unique username
        phone: "+989100000015",
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // ========================================
    // DRIVER Users (indices 13-14)
    // ========================================

    // DRIVER 1 (index 13)
    // Access: dashboard, my orders, settings, calendar
    prisma.user.create({
      data: {
        password: hashedPassword,
        firstName: "راننده",
        lastName: "اول",
        name: "driver1", // unique username
        phone: "+989100000016",
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // DRIVER 2 (index 14)
    prisma.user.create({
      data: {
        // No email - demonstrating optional email
        password: hashedPassword,
        firstName: "راننده",
        lastName: "دوم",
        name: "driver2", // unique username
        phone: "+989100000017",
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // ========================================
    // LAW FIRM Organization Users (indices 15-19)
    // ========================================

    // LAW FIRM ADMIN (index 15)
    // Access: dashboard, organization details, members, appointments, services, service categories
    prisma.user.create({
      data: {
        email: "law-admin@lawfirm.ir",
        password: hashedPassword,
        firstName: "مدیر",
        lastName: "دفتر",
        name: "law-admin", // unique username
        phone: "+989100000018",
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // LAW FIRM MANAGER (index 16)
    // Access: dashboard, organization details, members, appointments, services, service categories
    prisma.user.create({
      data: {
        email: "law-manager@lawfirm.ir",
        password: hashedPassword,
        firstName: "معاون",
        lastName: "دفتر",
        name: "law-manager", // unique username
        phone: "+989100000019",
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // LAW FIRM STAFF / RECEPTIONIST (index 17)
    // Access: dashboard, my appointments, my services, settings, calendar
    prisma.user.create({
      data: {
        email: "law-staff@lawfirm.ir",
        password: hashedPassword,
        firstName: "منشی",
        lastName: "دفتر",
        name: "law-staff", // unique username
        phone: "+989100000020",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // LAWYER 1 - Senior Attorney (index 18)
    // Service provider for legal consultations
    prisma.user.create({
      data: {
        email: "lawyer-senior@lawfirm.ir",
        password: hashedPassword,
        firstName: "دکتر",
        lastName: "وکیل‌زاده",
        name: "lawyer-senior", // unique username
        phone: "+989100000021",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // LAWYER 2 - Junior Attorney (index 19)
    // Service provider for legal consultations
    prisma.user.create({
      data: {
        email: "lawyer-junior@lawfirm.ir",
        password: hashedPassword,
        firstName: "سارا",
        lastName: "محمودی",
        name: "lawyer-junior", // unique username
        phone: "+989100000022",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // ========================================
    // DENTAL CLINIC Organization Users (indices 20-24)
    // ========================================

    // DENTAL CLINIC ADMIN (index 20)
    // Access: dashboard, organization details, members, appointments, services, service categories
    prisma.user.create({
      data: {
        email: "dental-admin@dentclin.ir",
        password: hashedPassword,
        firstName: "علی",
        lastName: "محمدی",
        name: "denital-admin", // unique username
        phone: "+989100000018",
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // DENTAL CLINIC MANAGER (index 21)
    // Access: dashboard, organization details, members, appointments, services, service categories
    prisma.user.create({
      data: {
        email: "dental-manager@dentclin.ir",
        password: hashedPassword,
        firstName: "معاون",
        lastName: "کلینیک",
        name: "denital-manager", // unique username
        phone: "+989100000019",
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // DENTAL CLINIC STAFF / RECEPTIONIST (index 22)
    // Access: dashboard, my appointments, my services, settings, calendar
    prisma.user.create({
      data: {
        email: "dental-staff@lawfirm.ir",
        password: hashedPassword,
        firstName: "آریا",
        lastName: "جمالی",
        name: "denital-staff", // unique username
        phone: "+989100000020",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // DOCTOR 1 - Senior Attorney (index 23)
    // Service provider for ...
    prisma.user.create({
      data: {
        email: "dental-senior@dentclin.ir",
        password: hashedPassword,
        firstName: "دکتر",
        lastName: "سید",
        name: "denital-senior", // unique username
        phone: "+989100000021",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // LAWYER 2 - Junior Attorney (index 24)
    // Service provider for legal consultations
    prisma.user.create({
      data: {
        email: "dental-junior@dentclin.ir",
        password: hashedPassword,
        firstName: "الهه",
        lastName: "فروغی",
        name: "denital-junior", // unique username
        phone: "+989100000022",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),
    // ========================================
    // Sicily SHOP Organization Users (indices 25-28)
    // ========================================

    // Sicily ADMIN (index 25)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        //email: "shop-admin@shop.ir", // optional
        password: hashedPassword,
        firstName: "حسین",
        lastName: "قادری",
        name: "hosein", // unique username
        phone: "+989100000002",
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // SHOP MANAGER (index 26)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        //email: "shop-manager@shop.ir", // optional
        password: hashedPassword,
        firstName: "معاون",
        lastName: "فروشگاه",
        name: "manager1", // unique username
        phone: "+989100000003",
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP STAFF (index 27)
    // Access: dashboard, my orders (if also CUSTOMER), settings, calendar
    // Note: STAFF without ADMIN/MANAGER org role has limited access
    prisma.user.create({
      data: {
        //email: "shop-staff@shop.ir", // optional
        password: hashedPassword,
        firstName: "کارمند",
        lastName: "فروشگاه",
        name: "sstaff1", // unique username
        phone: "+989100000004",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP DRIVER (index 28)
    // Access: dashboard, my orders, settings, calendar
    prisma.user.create({
      data: {
        password: hashedPassword,
        firstName: "راننده",
        lastName: "فروشگاه",
        name: "driver0", // unique username
        phone: "+989100000005",
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // ========================================
    // Chakme SHOP Organization Users (indices 29-32)
    // ========================================

    // Chakme ADMIN (index 29)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        //email: "shop-admin@shop.ir", // optional
        password: hashedPassword,
        firstName: "امیر",
        lastName: "صیادی",
        name: "amir", // unique username
        phone: "+989100000002",
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),

    // SHOP MANAGER (index 30)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        //email: "shop-manager@shop.ir", // optional
        password: hashedPassword,
        firstName: "معاون",
        lastName: "فروشگاه",
        name: "chakme1", // unique username
        phone: "+989100000003",
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP STAFF (index 31)
    // Access: dashboard, my orders (if also CUSTOMER), settings, calendar
    // Note: STAFF without ADMIN/MANAGER org role has limited access
    prisma.user.create({
      data: {
        //email: "shop-staff@shop.ir", // optional
        password: hashedPassword,
        firstName: "کارمند",
        lastName: "فروشگاه",
        name: "chakme2", // unique username
        phone: "+989100000004",
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "light",
      },
    }),

    // SHOP DRIVER (index 32)
    // Access: dashboard, my orders, settings, calendar
    prisma.user.create({
      data: {
        password: hashedPassword,
        firstName: "راننده",
        lastName: "فروشگاه",
        name: "chakme3", // unique username
        phone: "+989100000005",
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "dark",
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users with all roles\n`);
  // ========================================
  // 2. CREATE ORGANIZATIONS - SHOP and APPOINTMENT Types
  // ========================================
  console.log("🏢 Creating organizations...");

  // === SHOP Organizations ===
  const healthShop = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "فروشگاه اینترنتی سلامت",
      slug: "salamat-shop",
      description:
        "فروشگاه اینترنتی محصولات سلامتی و مکمل‌های غذایی با بهترین کیفیت و قیمت",
      address: "تهران، خیابان ولیعصر، پلاک ۱۲۳",
      phone: "+982188888888",
      email: "info@salamat-shop.ir",
      logo: "salamat-logo.jpg",
      coverImage: "salamat-cover.jpg",
      isActive: true,
    },
  });

  const foodDelivery = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "سفارش غذای خونه",
      slug: "khoone-food",
      description: "بهترین غذاهای خانگی با مواد اولیه تازه و کیفیت عالی",
      address: "تهران، خیابان انقلاب، پلاک ۶۷",
      phone: "+982188777777",
      email: "order@khoone-food.ir",
      logo: "food-logo.jpg",
      coverImage: "food-cover.jpg",
      isActive: true,
    },
  });

  const sicily = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "رستوران سیسیلی",
      slug: "sicily",
      description: "",
      address: "شهرکرد، خیابان کاشانی، ...",
      phone: "+982188555555",
      email: "info@sicily.ir",
      logo: "sicily-logo.jpg",
      coverImage: "sicily-cover.jpg",
      isActive: true,
    },
  });

  const chakme = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "کافه رستوران چکمه",
      slug: "chakme",
      description: "",
      address: "شهرکرد، خیابان کاشانی، ...",
      phone: "+982188555555",
      logo: "chakme-logo.jpg",
      coverImage: "chakme-cover.jpg",
      isActive: true,
    },
  });

  // === APPOINTMENT Organizations ===
  const beautyClinic = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "کلینیک زیبایی تی کال",
      slug: "tikal",
      description:
        "کلینیک تخصصی زیبایی و پوست با جدیدترین تکنولوژی‌های روز دنیا",
      address: "شهرکرد، خیابان کاشانی، کوچه 69، پلاک 3.2",
      phone: "+983832228906",
      email: "fariba.farhadi@gmail.com",
      logo: "tikal-logo.jpg",
      coverImage: "tikal-cover.jpg",
      isActive: true,
    },
  });

  const dentalClinic = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "دندانپزشکی لبخند",
      slug: "dental-smile",
      description: "مرکز تخصصی دندانپزشکی با بهترین متخصصان",
      address: "تهران، خیابان شریعتی، پلاک ۸۸",
      phone: "+982188991111",
      email: "info@dental-smile.ir",
      logo: "dental-logo.jpg",
      coverImage: "dental-cover.jpg",
      isActive: true,
    },
  });

  const spaCenter = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "اسپا آرامش",
      slug: "spa-aramesh",
      description: "مرکز تخصصی ماساژ و آرامش‌بخشی",
      address: "تهران، خیابان جردن، پلاک ۵۵",
      phone: "+982188992222",
      email: "info@spa-aramesh.ir",
      logo: "spa-logo.jpg",
      coverImage: "spa-cover.jpg",
      isActive: true,
    },
  });

  // === LAW FIRM Organization (APPOINTMENT type) ===
  const lawFirm = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: "fa",
      timezone: "Asia/Tehran",
      name: "دفتر وکالت عدالت",
      slug: "law-justice",
      description:
        "دفتر وکالت تخصصی با تجربه در پرونده‌های حقوقی، کیفری و تجاری. مشاوره حقوقی تخصصی با وکلای مجرب",
      address: "تهران، خیابان ولیعصر، بالاتر از میدان ونک، پلاک ۲۳۴، طبقه ۵",
      phone: "+982188555555",
      email: "info@law-justice.ir",
      logo: "law-logo.jpg",
      coverImage: "law-cover.jpg",
      isActive: true,
    },
  });

  console.log(`✅ Created 6 organizations (2 SHOP, 4 APPOINTMENT)\n`);

  // ========================================
  // 3. CREATE ORGANIZATION MEMBERS - All Role Combinations
  // Note: Each user can only belong to ONE organization (unique userId constraint)
  // ========================================
  console.log("👥 Creating organization members with all role combinations...");

  // Health Shop Members (SHOP type) - users[1-4]
  await prisma.organizationMember.create({
    data: {
      organizationId: healthShop.id,
      organizationSlug: healthShop.slug,
      userId: users[1].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: healthShop.id,
      organizationSlug: healthShop.slug,

      userId: users[2].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: healthShop.id,
      organizationSlug: healthShop.slug,

      userId: users[3].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: healthShop.id,
      organizationSlug: healthShop.slug,
      userId: users[4].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: healthShop.id,
      organizationSlug: healthShop.slug,
      userId: users[13].id,
      isActive: true,
    },
  });

  // Beauty Clinic Members (APPOINTMENT type) - users[5-9]
  await prisma.organizationMember.create({
    data: {
      organizationId: beautyClinic.id,
      organizationSlug: beautyClinic.slug,
      userId: users[5].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: beautyClinic.id,
      organizationSlug: beautyClinic.slug,
      userId: users[6].id,
      isActive: true,
    },
  });
  // Service providers
  await prisma.organizationMember.create({
    data: {
      organizationId: beautyClinic.id,
      organizationSlug: beautyClinic.slug,
      userId: users[7].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: beautyClinic.id,
      organizationSlug: beautyClinic.slug,
      userId: users[8].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: beautyClinic.id,
      organizationSlug: beautyClinic.slug,
      userId: users[9].id,
      isActive: true,
    },
  });

  // Law Firm Members (APPOINTMENT type) - users[15-19]
  await prisma.organizationMember.create({
    data: {
      organizationId: lawFirm.id,
      organizationSlug: lawFirm.slug,
      userId: users[15].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: lawFirm.id,
      organizationSlug: lawFirm.slug,
      userId: users[16].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: lawFirm.id,
      organizationSlug: lawFirm.slug,
      userId: users[17].id,
      isActive: true,
    },
  });
  // Lawyers (Service providers)
  await prisma.organizationMember.create({
    data: {
      organizationId: lawFirm.id,
      organizationSlug: lawFirm.slug,
      userId: users[18].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: lawFirm.id,
      organizationSlug: lawFirm.slug,
      userId: users[19].id,
      isActive: true,
    },
  });

  // Dental clinic Members (APPOINTMENT type) - users[15-19]
  await prisma.organizationMember.create({
    data: {
      organizationId: dentalClinic.id,
      organizationSlug: dentalClinic.slug,
      userId: users[20].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: dentalClinic.id,
      userId: users[21].id,
      organizationSlug: dentalClinic.slug,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: dentalClinic.id,
      organizationSlug: dentalClinic.slug,
      userId: users[22].id,
      isActive: true,
    },
  });
  // Lawyers (Service providers)
  await prisma.organizationMember.create({
    data: {
      organizationId: dentalClinic.id,
      organizationSlug: dentalClinic.slug,
      userId: users[23].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: dentalClinic.id,
      organizationSlug: dentalClinic.slug,
      userId: users[24].id,
      isActive: true,
    },
  });

  // Sicily Shop Members (SHOP type)
  await prisma.organizationMember.create({
    data: {
      organizationId: sicily.id,
      organizationSlug: sicily.slug,
      userId: users[25].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: sicily.id,
      organizationSlug: sicily.slug,
      userId: users[26].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: sicily.id,
      organizationSlug: sicily.slug,
      userId: users[27].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: sicily.id,
      organizationSlug: sicily.slug,
      userId: users[28].id,
      isActive: true,
    },
  });
  // Chakme Shop Members (SHOP type)

  await prisma.organizationMember.create({
    data: {
      organizationId: chakme.id,
      organizationSlug: chakme.slug,
      userId: users[29].id,
      isActive: true,
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: chakme.id,
      organizationSlug: chakme.slug,
      userId: users[30].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: chakme.id,
      organizationSlug: chakme.slug,
      userId: users[31].id,
      isActive: true,
    },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: chakme.id,
      organizationSlug: chakme.slug,
      userId: users[32].id,
      isActive: true,
    },
  });

  const allOrgs = [
    healthShop,
    foodDelivery,
    beautyClinic,
    dentalClinic,
    spaCenter,
    lawFirm,
    sicily,
    chakme,
  ];

  // Note: users[12-14] are CUSTOMERs - no organization membership

  console.log("✅ Created organization members with all role combinations\n");

  // ========================================
  // 5. CREATE ORGANIZATION SETTINGS
  // ========================================
  console.log("⚙️ Creating organization settings...");

  for (const org of allOrgs) {
    await prisma.organizationSettings.create({
      data: {
        organizationSlug: org.slug,
        settings: { theme: "light", language: "fa" },
        currency: "IRR",
        dateFormat: "YYYY/MM/DD",
        timeFormat: "24h",
        minimumOrderAmount: 100000,
        maximumOrderAmount: 50000000,
        deliveryRadius: 10,
        enablePickup: true,
        enableDelivery: true,
        emailNotifications: true,
        smsNotifications: false,
      },
    });
  }

  console.log("✅ Created organization settings\n");

  // ========================================
  // 5.5. CREATE BOOKING SETTINGS (APPOINTMENT)
  // ========================================
  console.log("📅 Creating booking settings for appointment organizations...");

  const appointmentOrgs = [beautyClinic, dentalClinic, spaCenter, lawFirm];

  for (const org of appointmentOrgs) {
    await prisma.bookingSettings.create({
      data: {
        organizationSlug: org.slug,
        // Slot configuration
        slotDuration: 30, // 30-minute slots
        bufferBefore: 5, // 5 minutes buffer before
        bufferAfter: 10, // 10 minutes buffer after
        // Booking rules
        minBookingNotice: 120, // 2 hours minimum notice
        maxBookingAdvance: 43200, // 30 days in advance
        maxAppointmentsPerDay: 20,
        allowCancellation: true,
        cancellationDeadline: 1440, // 24 hours before
        // Customer info requirements
        requirePhone: true,
        requireEmail: false,
        requireName: true,
        // Auto-confirmation (disabled - requires manual confirmation)
        autoConfirm: false,
      },
    });
  }

  console.log(
    `✅ Created booking settings for ${appointmentOrgs.length} appointment organizations\n`,
  );

  const allVariants = await prisma.productVariant.findMany();
  console.log(`✅ Created products with variants\n`);

  // ========================================
  // 8. CREATE SERVICE CATEGORIES & SERVICES (APPOINTMENT)
  // ========================================
  console.log("💅 Creating service categories and services...");

  // Beauty Clinic Services
  const beautyCategories = await Promise.all([
    prisma.serviceCategory.create({
      data: {
        organizationId: beautyClinic.id,
        name: "خدمات پوست",
        description: "پوست و زیبایی",
        sortOrder: 4,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: beautyClinic.id,
        name: "خدمات مو",
        description: "کوتاهی و رنگ",
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: beautyClinic.id,
        name: "آرایشی",
        description: "آرایش و میکاپ",
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: beautyClinic.id,
        name: "اصلاح",
        description: "اصلاح صورت و ابرو",
        sortOrder: 3,
        isActive: true,
      },
    }),
  ]);

  const beautyServices = await Promise.all([
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[0].id,
        serviceProviderId: users[7].id,
        name: "بوتاکس",
        description: "تزریق بوتاکس",
        price: 3500000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[0].id,
        serviceProviderId: users[8].id,
        name: "فیلر لب",
        description: "تزریق فیلر",
        price: 2800000,
        duration: 45,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[1].id,
        serviceProviderId: users[5].id,
        name: "کوتاهی مو",
        description: "کوتاهی مو",
        price: 350000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[1].id,
        serviceProviderId: users[7].id,
        name: "کوتاهی مو",
        description: "کوتاهی مو",
        price: 350000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[1].id,
        serviceProviderId: users[5].id,
        name: "رنگ مو",
        description: "رنگ مو",
        price: 800000,
        duration: 90,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[1].id,
        serviceProviderId: users[9].id,
        name: "رنگ مو",
        description: "رنگ مو",
        price: 800000,
        duration: 90,
        isActive: true,
        sortOrder: 3,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: beautyClinic.id,
        categoryId: beautyCategories[3].id,
        serviceProviderId: users[6].id,
        name: "اصلاح ابرو",
        description: "اصلاح ابرو",
        price: 200000,
        duration: 30,
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  // Dental Clinic Services
  const dentalCategories = await Promise.all([
    prisma.serviceCategory.create({
      data: {
        organizationId: dentalClinic.id,
        name: "خدمات دندان",
        description: "دندانپزشکی",
        sortOrder: 1,
        isActive: true,
      },
    }),
  ]);

  const dentalServices = await Promise.all([
    prisma.service.create({
      data: {
        organizationId: dentalClinic.id,
        categoryId: dentalCategories[0].id,
        serviceProviderId: users[10].id,
        name: "جرم‌گیری",
        description: "جرم‌گیری دندان",
        price: 500000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: dentalClinic.id,
        categoryId: dentalCategories[0].id,
        serviceProviderId: users[10].id,
        name: "سفیدکردن",
        description: "بلیچینگ",
        price: 1500000,
        duration: 60,
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  // SPA Services
  const spaCategories = await Promise.all([
    prisma.serviceCategory.create({
      data: {
        organizationId: spaCenter.id,
        name: "ماساژ",
        description: "انواع ماساژ",
        sortOrder: 1,
        isActive: true,
      },
    }),
  ]);

  const spaServices = await Promise.all([
    prisma.service.create({
      data: {
        organizationId: spaCenter.id,
        categoryId: spaCategories[0].id,
        name: "ماساژ سوئدی",
        description: "ماساژ آرامش‌بخش",
        price: 1200000,
        duration: 60,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: spaCenter.id,
        categoryId: spaCategories[0].id,
        name: "ماساژ تایلندی",
        description: "ماساژ تایلندی",
        price: 1500000,
        duration: 90,
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  // Law Firm Services
  const lawCategories = await Promise.all([
    prisma.serviceCategory.create({
      data: {
        organizationId: lawFirm.id,
        name: "مشاوره حقوقی",
        description: "مشاوره تخصصی حقوقی",
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: lawFirm.id,
        name: "امور کیفری",
        description: "پرونده‌های کیفری",
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: lawFirm.id,
        name: "امور تجاری",
        description: "قراردادها و امور تجاری",
        sortOrder: 3,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: lawFirm.id,
        name: "امور خانواده",
        description: "طلاق، مهریه، حضانت",
        sortOrder: 4,
        isActive: true,
      },
    }),
  ]);

  const lawServices = await Promise.all([
    // Legal Consultation Services
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[0].id,
        serviceProviderId: users[18].id,
        name: "مشاوره حقوقی عمومی",
        description: "مشاوره حقوقی عمومی با وکیل ارشد",
        price: 2000000,
        duration: 60,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[0].id,
        serviceProviderId: users[19].id,
        name: "مشاوره حقوقی تخصصی",
        description: "مشاوره تخصصی با وکیل پایه یک دادگستری",
        price: 3500000,
        duration: 90,
        isActive: true,
        sortOrder: 2,
      },
    }),
    // Criminal Law Services
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[1].id,
        serviceProviderId: users[18].id,
        name: "مشاوره پرونده کیفری",
        description: "بررسی و مشاوره پرونده‌های کیفری",
        price: 5000000,
        duration: 90,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[1].id,
        serviceProviderId: users[19].id,
        name: "دفاع در دادگاه کیفری",
        description: "دفاع تخصصی در دادگاه‌های کیفری",
        price: 15000000,
        duration: 120,
        isActive: true,
        sortOrder: 2,
      },
    }),
    // Commercial Law Services
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[2].id,
        serviceProviderId: users[19].id,
        name: "تنظیم قرارداد",
        description: "تنظیم و بررسی قراردادهای تجاری",
        price: 3000000,
        duration: 60,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[2].id,
        serviceProviderId: users[19].id,
        name: "مشاوره حقوقی شرکت‌ها",
        description: "مشاوره تخصصی برای شرکت‌ها و کسب‌وکارها",
        price: 4500000,
        duration: 90,
        isActive: true,
        sortOrder: 2,
      },
    }),
    // Family Law Services
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[3].id,
        serviceProviderId: users[19].id,
        name: "مشاوره طلاق توافقی",
        description: "مشاوره و پیگیری طلاق توافقی",
        price: 8000000,
        duration: 60,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: lawFirm.id,
        categoryId: lawCategories[3].id,
        serviceProviderId: users[18].id,
        name: "مشاوره مهریه و حضانت",
        description: "مشاوره تخصصی در امور مهریه و حضانت فرزند",
        price: 4000000,
        duration: 60,
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  console.log(`✅ Created service categories and services\n`);

  // ========================================
  // 9. CREATE APPOINTMENTS
  // ========================================
  console.log("📅 Creating appointments...");

  // Beauty Clinic Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[12].id,
      serviceId: beautyServices[0].id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() +
          2 * 24 * 60 * 60 * 1000 +
          10 * 60 * 60 * 1000 +
          30 * 60 * 1000,
      ),
      status: AppointmentStatus.CONFIRMED,
      notes: "اولین بار بوتاکس",
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[13].id,
      serviceId: beautyServices[2].id,
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() +
          1 * 24 * 60 * 60 * 1000 +
          14 * 60 * 60 * 1000 +
          30 * 60 * 1000,
      ),
      status: AppointmentStatus.PENDING,
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[14].id,
      serviceId: beautyServices[3].id,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() +
          5 * 24 * 60 * 60 * 1000 +
          17 * 60 * 60 * 1000 +
          30 * 60 * 1000,
      ),
      status: AppointmentStatus.PENDING,
    },
  });

  // Dental Clinic Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[12].id,
      serviceId: dentalServices[0].id,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() +
          3 * 24 * 60 * 60 * 1000 +
          9 * 60 * 60 * 1000 +
          30 * 60 * 1000,
      ),
      status: AppointmentStatus.CONFIRMED,
    },
  });

  // SPA Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[13].id,
      serviceId: spaServices[0].id,
      date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() + 4 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000,
      ),
      status: AppointmentStatus.PENDING,
      notes: "ماساژ آرامش‌بخش",
    },
  });

  // Law Firm Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[12].id,
      serviceId: lawServices[0].id,
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() + 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000,
      ),
      status: AppointmentStatus.CONFIRMED,
      notes: "مشاوره حقوقی عمومی - پرونده حقوقی",
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[13].id,
      serviceId: lawServices[2].id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() +
          2 * 24 * 60 * 60 * 1000 +
          15 * 60 * 60 * 1000 +
          30 * 60 * 1000,
      ),
      status: AppointmentStatus.PENDING,
      notes: "مشاوره پرونده کیفری",
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[14].id,
      serviceId: lawServices[6].id,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000,
      ),
      status: AppointmentStatus.PENDING,
      notes: "مشاوره طلاق توافقی",
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[12].id,
      serviceId: lawServices[4].id,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      startTime: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000,
      ),
      endTime: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000,
      ),
      status: AppointmentStatus.CONFIRMED,
      notes: "تنظیم قرارداد تجاری",
    },
  });

  console.log("✅ Created appointments\n");

  console.log("✅ Created orders\n");

  /*
  // ========================================
  // 10.5. CREATE GUEST CUSTOMERS, GUEST CARTS & GUEST ORDERS
  // ========================================
  console.log("🛒 Creating guest customers and guest cart data...");

  // Create Guest Customers
  const guestCustomers = await Promise.all([
    prisma.guestCustomer.create({
      data: {
        sessionId: generateSessionId("random1"),
        name: "علی محمدی",
        phone: "+989123456789",
        email: "ali.mohammadi@example.com",
        address: "تهران، خیابان آزادی، پلاک ۴۵",
      },
    }),
    prisma.guestCustomer.create({
      data: {
        sessionId: generateSessionId("random2"),
        name: "مریم احمدی",
        phone: "+989123456790",
        email: "maryam.ahmadi@example.com",
        address: "تهران، خیابان ولیعصر، کوچه ۱۲",
      },
    }),
    prisma.guestCustomer.create({
      data: {
        sessionId: generateSessionId("random3"),
        name: "رضا کریمی",
        phone: "+989123456791",
        // No email - demonstrating optional email
        address: "تهران، میدان تجریش، خیابان شریعتی",
      },
    }),
  ]);

  // Create Guest Orders (orders placed by guest customers)
  await prisma.order.create({
    data: {
      orderNumber: "ORD-GUEST-0001",
      organizationId: healthShop.id,
      guestCustomerId: guestCustomers[0].id,
      type: OrderType.DELIVERY,
      status: OrderStatus.DELIVERED,
      subtotal: 730000,
      deliveryFee: 50000,
      tax: 65700,
      total: 845700,
      deliveryAddress: guestCustomers[0].address,
      paidAt: new Date(),
      paymentMethod: PaymentMethod.CASH,
      deliveredAt: new Date(),
      items: {
        create: [
          {
            productId: healthProducts[0].id,
            variantId: allVariants[0]?.id || null,
            quantity: 1,
            price: 450000,
            discount: 0,
          },
          {
            productId: healthProducts[1].id,
            variantId: allVariants[1]?.id || null,
            quantity: 1,
            price: 280000,
            discount: 0,
          },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: "ORD-GUEST-0002",
      organizationId: foodDelivery.id,
      //guestCustomerId: guestCustomers[1].id,
      type: OrderType.DELIVERY,
      status: OrderStatus.PREPARING,
      subtotal: 670000,
      deliveryFee: 30000,
      tax: 60300,
      total: 760300,
      deliveryAddress: guestCustomers[1].address,
      paymentMethod: PaymentMethod.CASH,
      items: {
        create: [
          {
            productId: foodProducts[0].id,
            variantId: null,
            quantity: 1,
            price: 350000,
            discount: 0,
          },
          {
            productId: foodProducts[1].id,
            variantId: null,
            quantity: 1,
            price: 320000,
            discount: 0,
          },
        ],
      },
    },
  });

  // Create a Guest Cart with items (simulating an active guest shopping session)
  const guestCart = await prisma.guestCart.create({
    data: {
      sessionId: "guest-session-demo-" + Date.now(),
      organizationId: healthShop.id,
      status: CartStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  // Add items to the guest cart
  await prisma.guestCartItem.createMany({
    data: [
      {
        cartId: guestCart.id,
        variantId: allVariants[0]?.id || "",
        quantity: 2,
      },
      {
        cartId: guestCart.id,
        variantId: allVariants[1]?.id || "",
        quantity: 1,
      },
    ],
  });

  console.log(
    `✅ Created ${guestCustomers.length} guest customers, guest orders, and guest cart\n`,
  );
*/

  // ========================================
  // 12. CREATE FOLLOWS
  // ========================================
  console.log("❤️ Creating follows...");

  await prisma.follow.create({
    data: { organizationId: beautyClinic.id, customerId: users[12].id },
  });
  await prisma.follow.create({
    data: { organizationId: healthShop.id, customerId: users[13].id },
  });
  await prisma.follow.create({
    data: { organizationId: spaCenter.id, customerId: users[14].id },
  });
  await prisma.follow.create({
    data: { organizationId: lawFirm.id, customerId: users[12].id },
  });
  await prisma.follow.create({
    data: { organizationId: lawFirm.id, customerId: users[13].id },
  });

  console.log("✅ Created follows\n");

  // ========================================
  // 4. CREATE BUSINESS HOURS
  // ========================================
  console.log("🕐 Creating business hours...");

  const days: DayOfWeek[] = [
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
  ];
  // TODO: also create 'userBusinessHour' for staff (each staff user default businessHours should be set as their org. businessHours)
  for (const org of allOrgs) {
    for (const day of days) {
      await prisma.businessHour.create({
        data: {
          organizationId: org.id,
          day,
          openTime: day === DayOfWeek.THURSDAY ? "09:00" : "08:00",
          closeTime: day === DayOfWeek.THURSDAY ? "14:00" : "20:00",
          isOpen: true,
        },
      });
    }
    await prisma.businessHour.create({
      data: {
        organizationId: org.id,
        day: DayOfWeek.FRIDAY,
        openTime: "00:00",
        closeTime: "00:00",
        isOpen: false,
      },
    });
  }

  console.log("✅ Created business hours\n");

  // copy businessHours for staff members
  [healthShop, beautyClinic, dentalClinic].map((org) => {
    organizationService.copyBusinessHoursToAllStaff(org.id);
  });

  // ========================================
  // Summary
  // ========================================
  console.log("🎉 Database seeding completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`   - ${users.length} users with all role combinations`);
  console.log(`   - 6 organizations (2 SHOP, 4 APPOINTMENT)`);
  console.log(`   - 4 booking settings for appointment organizations`);
  /* console.log(
    `   - ${guestCustomers.length} guest customers for guest checkout testing`,
  );*/
  console.log(`   - All OrgMemberRole types: ADMIN, MANAGER, STAFF`);
  console.log("\n🔑 Test Credentials (all passwords: password123):");
  console.log("\n   === SUPER_ADMIN ===");
  console.log("   - Username: superadmin (Full access to all features)");

  console.log("\n   === SHOP Organization ===");
  console.log(
    "   - Username: shop-admin (ADMIN role, ADMIN org role - Access: orders, products, customers)",
  );
  console.log(
    "   - Username: shop-manager (MANAGER role, MANAGER org role - Access: orders, products)",
  );
  console.log(
    "   - Username: shop-staff (STAFF role, STAFF org role - Limited access)",
  );
  console.log("   - Username: shop-driver (DRIVER role - Access: my-orders)");

  console.log("\n   === APPOINTMENT Organization (Beauty Clinic) ===");
  console.log(
    "   - Username: appt-admin (ADMIN role, ADMIN org role - Access: Full appointment access)",
  );
  console.log(
    "   - Username: appt-manager (MANAGER role, MANAGER org role - Access: appointments, services,  my-appointments, my-services)",
  );
  console.log(
    "   - Username: appt-staff (STAFF role, STAFF org role - Access: my-appointments, my-services)",
  );
  console.log(
    "   - Username: staff-admin-appt (STAFF role, ADMIN org role - Full appointment access)",
  );
  console.log(
    "   - Username: staff-manager-appt (STAFF role, MANAGER org role - Full appointment access)",
  );

  console.log("\n   === LAW FIRM Organization (دفتر وکالت عدالت) ===");
  console.log(
    "   - Username: law-admin (ADMIN role, ADMIN org role - Access: appointments, services)",
  );
  console.log(
    "   - Username: law-manager (MANAGER role, MANAGER org role - Access: appointments, services)",
  );
  console.log(
    "   - Username: law-staff (STAFF role, STAFF org role - Access: my-appointments, my-services)",
  );
  console.log(
    "   - Username: lawyer-senior (STAFF role, STAFF org role - Service provider: Legal consultations)",
  );
  console.log(
    "   - Username: lawyer-junior (STAFF role, STAFF org role - Service provider: Legal consultations)",
  );
  console.log("\n   === CUSTOMER ===");
  console.log("   - Username: customer1 (Access: my-orders, my-appointments)");
  console.log("   - Username: customer2 (Access: my-orders, my-appointments)");
  console.log(
    "   - Username: customer3 (No email - Access: my-orders, my-appointments)",
  );
  console.log("\n   === DRIVER ===");
  console.log("   - Username: driver1 (Access: my-orders)");
  console.log("   - Username: driver2 (No email - Access: my-orders)");
  console.log("\n   === GUEST CUSTOMERS (for guest checkout testing) ===");
  console.log("   - Phone: +989123456789 (Ali Mohammadi - has orders)");
  console.log("   - Phone: +989123456790 (Maryam Ahmadi - has orders)");
  console.log("   - Phone: +989123456791 (Reza Karimi - no email)");
  console.log("\n📍 Universal Access (All Users):");
  console.log("   - Settings: /dashboard/settings");
  console.log("   - Calendar: /dashboard/calendar");
  console.log("\n🛒 Guest Shop Testing:");
  console.log("   - Visit: /shop/salamat-shop (Health Shop)");
  console.log("   - Visit: /shop/khoone-food (Food Delivery)");
  console.log("   - Add products to cart as guest");
  console.log("   - Checkout as guest without authentication");
  console.log("\n📅 Appointment Booking Testing:");
  console.log("   - Visit: /organizations/clinic-ruya (Beauty Clinic)");
  console.log("   - Visit: /organizations/dental-smile (Dental Clinic)");
  console.log("   - Visit: /organizations/spa-aramesh (SPA Center)");
  console.log(
    "   - Visit: /organizations/law-justice (Law Firm - دفتر وکالت عدالت)",
  );
  console.log(
    "\n📝 Note: Email is now optional. Users can authenticate using their unique username.",
  );
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
