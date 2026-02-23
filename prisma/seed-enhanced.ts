import { PrismaClient, OrganizationType, UserRole, OrgMemberRole, AppointmentStatus, CartStatus, OrderType, OrderStatus, PaymentStatus, PaymentMethod, DayOfWeek } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data (in reverse order of dependencies)
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shopCartItem.deleteMany();
  await prisma.shopCart.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
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

  console.log('✅ Cleaned existing data\n');

  // ========================================
  // 1. CREATE USERS - All Roles for Access Control Testing
  // ========================================
  console.log('👤 Creating users with all roles for access control testing...');

  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    // ========================================
    // SUPER_ADMIN (index 0)
    // Full access to all features, pages, and functionality
    // ========================================
    prisma.user.create({
      data: {
        // email is now optional
        password: hashedPassword,
        firstName: 'سوپر',
        lastName: 'ادمین',
        name: 'superadmin', // unique username
        phone: '+989100000001',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'dark',
      },
    }),

    // ========================================
    // SHOP Organization Users (indices 1-5)
    // ========================================
    
    // SHOP ADMIN (index 1)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        email: 'shop-admin@shop.ir', // optional
        password: hashedPassword,
        firstName: 'مدیر',
        lastName: 'فروشگاه',
        name: 'shop-admin', // unique username
        phone: '+989100000002',
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // SHOP MANAGER (index 2)
    // Access: dashboard, organization details, members, orders, products, product categories
    prisma.user.create({
      data: {
        email: 'shop-manager@shop.ir', // optional
        password: hashedPassword,
        firstName: 'معاون',
        lastName: 'فروشگاه',
        name: 'shop-manager', // unique username
        phone: '+989100000003',
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // SHOP STAFF (index 3)
    // Access: dashboard, my orders (if also CUSTOMER), settings, calendar
    // Note: STAFF without ADMIN/MANAGER org role has limited access
    prisma.user.create({
      data: {
        email: 'shop-staff@shop.ir', // optional
        password: hashedPassword,
        firstName: 'کارمند',
        lastName: 'فروشگاه',
        name: 'shop-staff', // unique username
        phone: '+989100000004',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // SHOP DRIVER (index 4)
    // Access: dashboard, my orders, settings, calendar
    prisma.user.create({
      data: {
        email: 'shop-driver@shop.ir', // optional
        password: hashedPassword,
        firstName: 'راننده',
        lastName: 'فروشگاه',
        name: 'shop-driver', // unique username
        phone: '+989100000005',
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // ========================================
    // APPOINTMENT Organization Users (indices 5-10)
    // ========================================

    // APPOINTMENT ADMIN (index 5)
    // Access: dashboard, organization details, members, appointments, services, service categories
    prisma.user.create({
      data: {
        email: 'appt-admin@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'مدیر',
        lastName: 'کلینیک',
        name: 'appt-admin', // unique username
        phone: '+989100000006',
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // APPOINTMENT MANAGER (index 6)
    // Access: dashboard, organization details, members, appointments, services, service categories
    prisma.user.create({
      data: {
        email: 'appt-manager@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'معاون',
        lastName: 'کلینیک',
        name: 'appt-manager', // unique username
        phone: '+989100000007',
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // APPOINTMENT STAFF with STAFF org role (index 7)
    // Access: dashboard, my appointments, my services, settings, calendar
    prisma.user.create({
      data: {
        email: 'appt-staff@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'کارمند',
        lastName: 'کلینیک',
        name: 'appt-staff', // unique username
        phone: '+989100000008',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // STAFF with ADMIN org role in APPOINTMENT org (index 8)
    // Access: dashboard, organizations, appointments, services, service categories
    prisma.user.create({
      data: {
        email: 'staff-admin-appt@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'کارمند',
        lastName: 'ادمین',
        name: 'staff-admin-appt', // unique username
        phone: '+989100000009',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // STAFF with MANAGER org role in APPOINTMENT org (index 9)
    // Access: dashboard, organizations, appointments, services, service categories
    prisma.user.create({
      data: {
        email: 'staff-manager-appt@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'کارمند',
        lastName: 'منیجر',
        name: 'staff-manager-appt', // unique username
        phone: '+989100000010',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // Service Provider 1 - Dermatologist (index 10)
    prisma.user.create({
      data: {
        email: 'dr-derma@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'دکتر',
        lastName: 'پوست',
        name: 'dr-derma', // unique username
        phone: '+989100000011',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // Service Provider 2 - Hair Stylist (index 11)
    prisma.user.create({
      data: {
        email: 'hairstylist@clinic.ir', // optional
        password: hashedPassword,
        firstName: 'آرایشگر',
        lastName: 'مو',
        name: 'hairstylist', // unique username
        phone: '+989100000012',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // ========================================
    // CUSTOMER Users (indices 12-14)
    // ========================================

    // CUSTOMER 1 (index 12)
    // Access: dashboard, my orders, my appointments, settings, calendar
    prisma.user.create({
      data: {
        email: 'customer1@example.com', // optional
        password: hashedPassword,
        firstName: 'مشتری',
        lastName: 'اول',
        name: 'customer1', // unique username
        phone: '+989100000013',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // CUSTOMER 2 (index 13)
    prisma.user.create({
      data: {
        email: 'customer2@example.com', // optional
        password: hashedPassword,
        firstName: 'مشتری',
        lastName: 'دوم',
        name: 'customer2', // unique username
        phone: '+989100000014',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'dark',
      },
    }),

    // CUSTOMER 3 (index 14)
    prisma.user.create({
      data: {
        // No email - demonstrating optional email
        password: hashedPassword,
        firstName: 'مشتری',
        lastName: 'سوم',
        name: 'customer3', // unique username
        phone: '+989100000015',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // ========================================
    // DRIVER Users (indices 15-16)
    // ========================================

    // DRIVER 1 (index 15)
    // Access: dashboard, my orders, settings, calendar
    prisma.user.create({
      data: {
        email: 'driver1@shop.ir', // optional
        password: hashedPassword,
        firstName: 'راننده',
        lastName: 'اول',
        name: 'driver1', // unique username
        phone: '+989100000016',
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),

    // DRIVER 2 (index 16)
    prisma.user.create({
      data: {
        // No email - demonstrating optional email
        password: hashedPassword,
        firstName: 'راننده',
        lastName: 'دوم',
        name: 'driver2', // unique username
        phone: '+989100000017',
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users with all roles\n`);

  // ========================================
  // 2. CREATE ORGANIZATIONS - SHOP and APPOINTMENT Types
  // ========================================
  console.log('🏢 Creating organizations...');

  // === SHOP Organizations ===
  const healthShop = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      name: 'فروشگاه اینترنتی سلامت',
      slug: 'salamat-shop',
      description: 'فروشگاه اینترنتی محصولات سلامتی و مکمل‌های غذایی با بهترین کیفیت و قیمت',
      address: 'تهران، خیابان ولیعصر، پلاک ۱۲۳',
      phone: '+982188888888',
      email: 'info@salamat-shop.ir',
      logo: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=200',
      coverImage: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=1200',
      isActive: true,
    },
  });

  const foodDelivery = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      name: 'سفارش غذای خونه',
      slug: 'khoone-food',
      description: 'بهترین غذاهای خانگی با مواد اولیه تازه و کیفیت عالی',
      address: 'تهران، خیابان انقلاب، پلاک ۶۷',
      phone: '+982188777777',
      email: 'order@khoone-food.ir',
      logo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200',
      coverImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200',
      isActive: true,
    },
  });

  // === APPOINTMENT Organizations ===
  const beautyClinic = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      name: 'کلینیک زیبایی رویا',
      slug: 'clinic-ruya',
      description: 'کلینیک تخصصی زیبایی و پوست با جدیدترین تکنولوژی‌های روز دنیا',
      address: 'تهران، خیابان میرداماد، پلاک ۴۵',
      phone: '+982188999999',
      email: 'info@clinic-ruya.ir',
      logo: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200',
      coverImage: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200',
      isActive: true,
    },
  });

  const dentalClinic = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      name: 'دندانپزشکی لبخند',
      slug: 'dental-smile',
      description: 'مرکز تخصصی دندانپزشکی با بهترین متخصصان',
      address: 'تهران، خیابان شریعتی، پلاک ۸۸',
      phone: '+982188991111',
      email: 'info@dental-smile.ir',
      logo: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=200',
      coverImage: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200',
      isActive: true,
    },
  });

  const spaCenter = await prisma.organization.create({
    data: {
      type: OrganizationType.APPOINTMENT,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      name: 'اسپا آرامش',
      slug: 'spa-aramesh',
      description: 'مرکز تخصصی ماساژ و آرامش‌بخشی',
      address: 'تهران، خیابان جردن، پلاک ۵۵',
      phone: '+982188992222',
      email: 'info@spa-aramesh.ir',
      logo: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200',
      coverImage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200',
      isActive: true,
    },
  });

  console.log(`✅ Created 5 organizations (2 SHOP, 3 APPOINTMENT)\n`);

  // ========================================
  // 3. CREATE ORGANIZATION MEMBERS - All Role Combinations
  // Note: Each user can only belong to ONE organization (unique userId constraint)
  // ========================================
  console.log('👥 Creating organization members with all role combinations...');

  // Health Shop Members (SHOP type) - users[1-4, 15]
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[1].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[2].id, role: OrgMemberRole.MANAGER, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[3].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[4].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[15].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  // Beauty Clinic Members (APPOINTMENT type) - users[5-11]
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[5].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[6].id, role: OrgMemberRole.MANAGER, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[7].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  // STAFF with ADMIN org role in APPOINTMENT org
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[8].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  // STAFF with MANAGER org role in APPOINTMENT org
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[9].id, role: OrgMemberRole.MANAGER, isActive: true },
  });
  // Service providers
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[10].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[11].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  // Note: users[12-14] are CUSTOMERs - no organization membership
  // Note: users[16] is DRIVER - no organization membership (drivers are assigned via orders)

  console.log('✅ Created organization members with all role combinations\n');

  // ========================================
  // 4. CREATE BUSINESS HOURS
  // ========================================
  console.log('🕐 Creating business hours...');

  const allOrgs = [healthShop, foodDelivery, beautyClinic, dentalClinic, spaCenter];
  const days: DayOfWeek[] = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY];
  
  for (const org of allOrgs) {
    for (const day of days) {
      await prisma.businessHour.create({
        data: {
          organizationId: org.id,
          day,
          openTime: day === DayOfWeek.THURSDAY ? '09:00' : '08:00',
          closeTime: day === DayOfWeek.THURSDAY ? '14:00' : '20:00',
          isOpen: true,
        },
      });
    }
    await prisma.businessHour.create({
      data: {
        organizationId: org.id,
        day: DayOfWeek.FRIDAY,
        openTime: '00:00',
        closeTime: '00:00',
        isOpen: false,
      },
    });
  }

  console.log('✅ Created business hours\n');

  // ========================================
  // 5. CREATE ORGANIZATION SETTINGS
  // ========================================
  console.log('⚙️ Creating organization settings...');

  for (const org of allOrgs) {
    await prisma.organizationSettings.create({
      data: {
        organizationId: org.id,
        settings: { theme: 'light', language: 'fa' },
        currency: 'IRR',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: '24h',
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

  console.log('✅ Created organization settings\n');

  // ========================================
  // 6. CREATE PRODUCT CATEGORIES (SHOP)
  // ========================================
  console.log('📦 Creating product categories...');

  const healthCategories = await Promise.all([
    prisma.productCategory.create({ data: { organizationId: healthShop.id, name: 'مکمل‌های غذایی', description: 'انواع مکمل‌ها', sortOrder: 1, isActive: true } }),
    prisma.productCategory.create({ data: { organizationId: healthShop.id, name: 'محصولات پوستی', description: 'مراقبت پوست', sortOrder: 2, isActive: true } }),
  ]);

  const foodCategories = await Promise.all([
    prisma.productCategory.create({ data: { organizationId: foodDelivery.id, name: 'غذاهای اصلی', description: 'غذاهای ایرانی', sortOrder: 1, isActive: true } }),
    prisma.productCategory.create({ data: { organizationId: foodDelivery.id, name: 'پیش غذا', description: 'سالاد و سوپ', sortOrder: 2, isActive: true } }),
  ]);

  console.log(`✅ Created product categories\n`);

  // ========================================
  // 7. CREATE PRODUCTS & VARIANTS
  // ========================================
  console.log('🛍️ Creating products and variants...');

  const healthProducts = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: healthShop.id,
        categoryId: healthCategories[0].id,
        name: 'قرص مولتی ویتامین',
        description: 'مولتی ویتامین مینرال',
        basePrice: 450000,
        sku: 'HEALTH-SUP-001',
        images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'],
        trackInventory: true,
        lowStockThreshold: 20,
        isActive: true,
        sortOrder: 1,
        variants: { create: [{ name: '۳۰ عددی', price: 450000, inventory: 100, sku: 'HEALTH-SUP-001-30' }] },
      },
    }),
    prisma.product.create({
      data: {
        organizationId: healthShop.id,
        categoryId: healthCategories[1].id,
        name: 'کرم مرطوب‌کننده',
        description: 'کرم مرطوب‌کننده صورت',
        basePrice: 280000,
        sku: 'HEALTH-SKIN-001',
        images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400'],
        trackInventory: true,
        lowStockThreshold: 15,
        isActive: true,
        sortOrder: 1,
        variants: { create: [{ name: '۵۰ میلی', price: 280000, inventory: 50, sku: 'HEALTH-SKIN-001-50' }] },
      },
    }),
  ]);

  const foodProducts = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: foodDelivery.id,
        categoryId: foodCategories[0].id,
        name: 'کباب کوبیده',
        description: 'کباب کوبیده با بهترین گوشت',
        basePrice: 350000,
        sku: 'FOOD-KB-001',
        images: ['https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400'],
        trackInventory: true,
        lowStockThreshold: 10,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: foodDelivery.id,
        categoryId: foodCategories[0].id,
        name: 'جوجه کباب',
        description: 'جوجه کباب زعفرانی',
        basePrice: 320000,
        sku: 'FOOD-JJ-001',
        images: ['https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400'],
        trackInventory: true,
        lowStockThreshold: 10,
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  const allVariants = await prisma.productVariant.findMany();
  console.log(`✅ Created products with variants\n`);

  // ========================================
  // 8. CREATE SERVICE CATEGORIES & SERVICES (APPOINTMENT)
  // ========================================
  console.log('💅 Creating service categories and services...');

  // Beauty Clinic Services
  const beautyCategories = await Promise.all([
    prisma.serviceCategory.create({ data: { organizationId: beautyClinic.id, name: 'خدمات پوست', description: 'پوست و زیبایی', sortOrder: 1, isActive: true } }),
    prisma.serviceCategory.create({ data: { organizationId: beautyClinic.id, name: 'خدمات مو', description: 'کوتاهی و رنگ', sortOrder: 2, isActive: true } }),
    prisma.serviceCategory.create({ data: { organizationId: beautyClinic.id, name: 'آرایشی', description: 'آرایش و میکاپ', sortOrder: 3, isActive: true } }),
  ]);

  const beautyServices = await Promise.all([
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[0].id, serviceProviderId: users[10].id, name: 'بوتاکس', description: 'تزریق بوتاکس', price: 3500000, duration: 30, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[0].id, serviceProviderId: users[10].id, name: 'فیلر لب', description: 'تزریق فیلر', price: 2800000, duration: 45, isActive: true, sortOrder: 2 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[1].id, serviceProviderId: users[11].id, name: 'کوتاهی مو', description: 'کوتاهی مو', price: 350000, duration: 30, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[1].id, serviceProviderId: users[11].id, name: 'رنگ مو', description: 'رنگ مو', price: 800000, duration: 90, isActive: true, sortOrder: 2 } }),
  ]);

  // Dental Clinic Services
  const dentalCategories = await Promise.all([
    prisma.serviceCategory.create({ data: { organizationId: dentalClinic.id, name: 'خدمات دندان', description: 'دندانپزشکی', sortOrder: 1, isActive: true } }),
  ]);

  const dentalServices = await Promise.all([
    prisma.service.create({ data: { organizationId: dentalClinic.id, categoryId: dentalCategories[0].id, serviceProviderId: users[10].id, name: 'جرم‌گیری', description: 'جرم‌گیری دندان', price: 500000, duration: 30, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: dentalClinic.id, categoryId: dentalCategories[0].id, serviceProviderId: users[10].id, name: 'سفیدکردن', description: 'بلیچینگ', price: 1500000, duration: 60, isActive: true, sortOrder: 2 } }),
  ]);

  // SPA Services
  const spaCategories = await Promise.all([
    prisma.serviceCategory.create({ data: { organizationId: spaCenter.id, name: 'ماساژ', description: 'انواع ماساژ', sortOrder: 1, isActive: true } }),
  ]);

  const spaServices = await Promise.all([
    prisma.service.create({ data: { organizationId: spaCenter.id, categoryId: spaCategories[0].id, name: 'ماساژ سوئدی', description: 'ماساژ آرامش‌بخش', price: 1200000, duration: 60, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: spaCenter.id, categoryId: spaCategories[0].id, name: 'ماساژ تایلندی', description: 'ماساژ تایلندی', price: 1500000, duration: 90, isActive: true, sortOrder: 2 } }),
  ]);

  console.log(`✅ Created service categories and services\n`);

  // ========================================
  // 9. CREATE APPOINTMENTS
  // ========================================
  console.log('📅 Creating appointments...');

  // Beauty Clinic Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[12].id,
      serviceId: beautyServices[0].id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      notes: 'اولین بار بوتاکس',
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[13].id,
      serviceId: beautyServices[2].id,
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.PENDING,
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[14].id,
      serviceId: beautyServices[3].id,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.PENDING,
    },
  });

  // Dental Clinic Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[12].id,
      serviceId: dentalServices[0].id,
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
    },
  });

  // SPA Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[13].id,
      serviceId: spaServices[0].id,
      date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      status: AppointmentStatus.PENDING,
      notes: 'ماساژ آرامش‌بخش',
    },
  });

  console.log('✅ Created appointments\n');

  // ========================================
  // 10. CREATE ORDERS
  // ========================================
  console.log('📋 Creating orders...');

  await prisma.order.create({
    data: {
      orderNumber: 'ORD-1404-0001',
      organizationId: healthShop.id,
      customerId: users[12].id,
      driverId: users[15].id,
      type: OrderType.DELIVERY,
      status: OrderStatus.DELIVERED,
      subtotal: 800000,
      deliveryFee: 50000,
      tax: 72000,
      total: 922000,
      deliveryAddress: 'تهران، خ ولیعصر',
      paidAt: new Date(),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      deliveredAt: new Date(),
      items: { create: [{ productId: healthProducts[0].id, variantId: allVariants[0]?.id || '', quantity: 1, price: 450000, discount: 0 }] },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: 'ORD-1404-0002',
      organizationId: foodDelivery.id,
      customerId: users[13].id,
      driverId: users[16].id,
      type: OrderType.DELIVERY,
      status: OrderStatus.PREPARING,
      subtotal: 350000,
      deliveryFee: 30000,
      tax: 31500,
      total: 411500,
      deliveryAddress: 'تهران، خ انقلاب',
      paymentMethod: PaymentMethod.CASH,
      items: { create: [{ productId: foodProducts[0].id, variantId: null, quantity: 1, price: 350000, discount: 0 }] },
    },
  });

  await prisma.order.create({
    data: {
      orderNumber: 'ORD-1404-0003',
      organizationId: healthShop.id,
      customerId: users[14].id,
      type: OrderType.PICK_UP,
      status: OrderStatus.PLACED,
      subtotal: 560000,
      deliveryFee: 0,
      tax: 50400,
      total: 610400,
      paymentMethod: PaymentMethod.CASH,
      items: { create: [{ productId: healthProducts[1].id, variantId: allVariants[1]?.id || '', quantity: 2, price: 280000, discount: 0 }] },
    },
  });

  console.log('✅ Created orders\n');

  // ========================================
  // 11. CREATE REVIEWS
  // ========================================
  console.log('⭐ Creating reviews...');

  await prisma.review.create({
    data: { organizationId: beautyClinic.id, userId: users[12].id, rating: 5, comment: 'عالی بود', isVerifiedPurchase: true },
  });

  await prisma.review.create({
    data: { organizationId: healthShop.id, userId: users[13].id, rating: 4, comment: 'خوب بود', isVerifiedPurchase: true },
  });

  console.log('✅ Created reviews\n');

  // ========================================
  // 12. CREATE FOLLOWS
  // ========================================
  console.log('❤️ Creating follows...');

  await prisma.follow.create({ data: { organizationId: beautyClinic.id, customerId: users[12].id } });
  await prisma.follow.create({ data: { organizationId: healthShop.id, customerId: users[13].id } });
  await prisma.follow.create({ data: { organizationId: spaCenter.id, customerId: users[14].id } });

  console.log('✅ Created follows\n');

  // ========================================
  // Summary
  // ========================================
  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${users.length} users with all role combinations`);
  console.log(`   - 5 organizations (2 SHOP, 3 APPOINTMENT)`);
  console.log(`   - All OrgMemberRole types: ADMIN, MANAGER, STAFF`);
  console.log('\n🔑 Test Credentials (all passwords: password123):');
  console.log('\n   === SUPER_ADMIN ===');
  console.log('   - Username: superadmin (Full access to all features)');
  console.log('\n   === SHOP Organization ===');
  console.log('   - Username: shop-admin (ADMIN role, ADMIN org role - Access: orders, products, customers)');
  console.log('   - Username: shop-manager (MANAGER role, MANAGER org role - Access: orders, products)');
  console.log('   - Username: shop-staff (STAFF role, STAFF org role - Limited access)');
  console.log('   - Username: shop-driver (DRIVER role - Access: my-orders)');
  console.log('\n   === APPOINTMENT Organization ===');
  console.log('   - Username: appt-admin (ADMIN role, ADMIN org role - Access: appointments, services)');
  console.log('   - Username: appt-manager (MANAGER role, MANAGER org role - Access: appointments, services)');
  console.log('   - Username: appt-staff (STAFF role, STAFF org role - Access: my-appointments, my-services)');
  console.log('   - Username: staff-admin-appt (STAFF role, ADMIN org role - Full appointment access)');
  console.log('   - Username: staff-manager-appt (STAFF role, MANAGER org role - Full appointment access)');
  console.log('\n   === CUSTOMER ===');
  console.log('   - Username: customer1 (Access: my-orders, my-appointments)');
  console.log('   - Username: customer2 (Access: my-orders, my-appointments)');
  console.log('   - Username: customer3 (No email - Access: my-orders, my-appointments)');
  console.log('\n   === DRIVER ===');
  console.log('   - Username: driver1 (Access: my-orders)');
  console.log('   - Username: driver2 (No email - Access: my-orders)');
  console.log('\n📍 Universal Access (All Users):');
  console.log('   - Settings: /dashboard/settings');
  console.log('   - Calendar: /dashboard/calendar');
  console.log('\n📝 Note: Email is now optional. Users can authenticate using their unique username.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
