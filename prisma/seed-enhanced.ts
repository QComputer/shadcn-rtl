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
  // 1. CREATE USERS - All Roles
  // ========================================
  console.log('👤 Creating users with all roles...');

  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    // SUPER_ADMIN (index 0)
    prisma.user.create({
      data: {
        email: 'superadmin@example.com',
        password: hashedPassword,
        firstName: 'آدمین',
        lastName: 'اصلی',
        name: 'آدمین اصلی',
        phone: '+989100000001',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'dark',
      },
    }),
    // ADMIN (index 1)
    prisma.user.create({
      data: {
        email: 'admin@shop.ir',
        password: hashedPassword,
        firstName: 'محمد',
        lastName: 'رحیمی',
        name: 'محمد رحیمی',
        phone: '+989100000002',
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // MANAGER (index 2)
    prisma.user.create({
      data: {
        email: 'manager@clinic.ir',
        password: hashedPassword,
        firstName: 'سارا',
        lastName: 'احمدی',
        name: 'سارا احمدی',
        phone: '+989100000003',
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // STAFF (index 3)
    prisma.user.create({
      data: {
        email: 'staff@shop.ir',
        password: hashedPassword,
        firstName: 'علی',
        lastName: 'محمدی',
        name: 'علی محمدی',
        phone: '+989100000004',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // DRIVER (index 4)
    prisma.user.create({
      data: {
        email: 'driver@shop.ir',
        password: hashedPassword,
        firstName: 'رضا',
        lastName: 'طالبی',
        name: 'رضا طالبی',
        phone: '+989100000005',
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // CUSTOMER 1 (index 5)
    prisma.user.create({
      data: {
        email: 'customer1@example.com',
        password: hashedPassword,
        firstName: 'مریم',
        lastName: 'کاظمی',
        name: 'مریم کاظمی',
        phone: '+989100000006',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // CUSTOMER 2 (index 6)
    prisma.user.create({
      data: {
        email: 'customer2@example.com',
        password: hashedPassword,
        firstName: 'نورا',
        lastName: 'رضایی',
        name: 'نورا رضایی',
        phone: '+989100000007',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'dark',
      },
    }),
    // CUSTOMER 3 (index 7)
    prisma.user.create({
      data: {
        email: 'customer3@example.com',
        password: hashedPassword,
        firstName: 'پارسا',
        lastName: 'وحیدی',
        name: 'پارسا وحیدی',
        phone: '+989100000008',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // CUSTOMER 4 (index 8)
    prisma.user.create({
      data: {
        email: 'customer4@example.com',
        password: hashedPassword,
        firstName: 'مینا',
        lastName: 'جلیلی',
        name: 'مینا جلیلی',
        phone: '+989100000009',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // SERVICE PROVIDER 1 - Dermatologist (index 9)
    prisma.user.create({
      data: {
        email: 'dr.dermatologist@clinic.ir',
        password: hashedPassword,
        firstName: 'دکتر',
        lastName: 'پوست',
        name: 'دکتر پوست',
        phone: '+989100000010',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // SERVICE PROVIDER 2 - Hair Stylist (index 10)
    prisma.user.create({
      data: {
        email: 'hairstylist@clinic.ir',
        password: hashedPassword,
        firstName: 'نازنین',
        lastName: 'میرزایی',
        name: 'نازنین میرزایی',
        phone: '+989100000011',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // SERVICE PROVIDER 3 - Massage Therapist (index 11)
    prisma.user.create({
      data: {
        email: 'masseur@spa.ir',
        password: hashedPassword,
        firstName: 'حمید',
        lastName: 'قاسمی',
        name: 'حمید قاسمی',
        phone: '+989100000012',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // SERVICE PROVIDER 4 - Beauty Consultant (index 12)
    prisma.user.create({
      data: {
        email: 'beautician@clinic.ir',
        password: hashedPassword,
        firstName: 'زهرا',
        lastName: 'ابراهیمی',
        name: 'زهرا ابراهیمی',
        phone: '+989100000013',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    // SECOND MANAGER (index 13)
    prisma.user.create({
      data: {
        email: 'manager2@shop.ir',
        password: hashedPassword,
        firstName: 'امیر',
        lastName: 'نوری',
        name: 'امیر نوری',
        phone: '+989100000014',
        role: UserRole.MANAGER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users with all roles\n`);

  // ========================================
  // 2. CREATE ORGANIZATIONS - All Types
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

  const electronicsShop = await prisma.organization.create({
    data: {
      type: OrganizationType.SHOP,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      name: 'دیجی کالا',
      slug: 'digikala-shop',
      description: 'فروشگاه تخصصی لوازم الکترونیکی و دیجیتال',
      address: 'تهران، خیابان آزادی، پلاک ۱۰۰',
      phone: '+982188666666',
      email: 'info@digikala-shop.ir',
      logo: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=200',
      coverImage: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=1200',
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

  console.log(`✅ Created 6 organizations (3 SHOP, 3 APPOINTMENT)\n`);

  // ========================================
  // 3. CREATE ORGANIZATION MEMBERS - All Roles
  // ========================================
  console.log('👥 Creating organization members...');

  // Health Shop Members
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[1].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[13].id, role: OrgMemberRole.MANAGER, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[3].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: healthShop.id, userId: users[4].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  // Food Delivery Members
  await prisma.organizationMember.create({
    data: { organizationId: foodDelivery.id, userId: users[1].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: foodDelivery.id, userId: users[3].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: foodDelivery.id, userId: users[4].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  // Electronics Shop Members
  await prisma.organizationMember.create({
    data: { organizationId: electronicsShop.id, userId: users[1].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: electronicsShop.id, userId: users[2].id, role: OrgMemberRole.MANAGER, isActive: true },
  });

  // Beauty Clinic Members
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[2].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[9].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[10].id, role: OrgMemberRole.STAFF, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: beautyClinic.id, userId: users[12].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  // Dental Clinic Members
  await prisma.organizationMember.create({
    data: { organizationId: dentalClinic.id, userId: users[2].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: dentalClinic.id, userId: users[9].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  // SPA Center Members
  await prisma.organizationMember.create({
    data: { organizationId: spaCenter.id, userId: users[2].id, role: OrgMemberRole.ADMIN, isActive: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: spaCenter.id, userId: users[11].id, role: OrgMemberRole.STAFF, isActive: true },
  });

  console.log('✅ Created organization members with all roles\n');

  // ========================================
  // 4. CREATE BUSINESS HOURS
  // ========================================
  console.log('🕐 Creating business hours...');

  const allOrgs = [healthShop, foodDelivery, electronicsShop, beautyClinic, dentalClinic, spaCenter];
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

  await prisma.organizationSettings.create({
    data: {
      organizationId: healthShop.id,
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

  await prisma.organizationSettings.create({
    data: {
      organizationId: foodDelivery.id,
      settings: { theme: 'light', language: 'fa' },
      currency: 'IRR',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h',
      minimumOrderAmount: 50000,
      deliveryRadius: 5,
      enablePickup: true,
      enableDelivery: true,
      emailNotifications: true,
      smsNotifications: false,
    },
  });

  await prisma.organizationSettings.create({
    data: {
      organizationId: electronicsShop.id,
      settings: { theme: 'dark', language: 'fa' },
      currency: 'IRR',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h',
      minimumOrderAmount: 500000,
      deliveryRadius: 15,
      enablePickup: true,
      enableDelivery: true,
      emailNotifications: true,
      smsNotifications: true,
    },
  });

  await prisma.organizationSettings.create({
    data: {
      organizationId: beautyClinic.id,
      settings: { theme: 'light', language: 'fa' },
      currency: 'IRR',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h',
      enablePickup: false,
      enableDelivery: false,
      emailNotifications: true,
      smsNotifications: true,
    },
  });

  await prisma.organizationSettings.create({
    data: {
      organizationId: dentalClinic.id,
      settings: { theme: 'light', language: 'fa' },
      currency: 'IRR',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h',
      enablePickup: false,
      enableDelivery: false,
      emailNotifications: true,
      smsNotifications: true,
    },
  });

  await prisma.organizationSettings.create({
    data: {
      organizationId: spaCenter.id,
      settings: { theme: 'light', language: 'fa' },
      currency: 'IRR',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: '24h',
      enablePickup: false,
      enableDelivery: false,
      emailNotifications: true,
      smsNotifications: true,
    },
  });

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

  const electronicsCategories = await Promise.all([
    prisma.productCategory.create({ data: { organizationId: electronicsShop.id, name: 'موبایل و تبلت', description: 'گوشی و تبلت', sortOrder: 1, isActive: true } }),
    prisma.productCategory.create({ data: { organizationId: electronicsShop.id, name: 'لپتاپ', description: 'لپتاپ و کامپیوتر', sortOrder: 2, isActive: true } }),
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
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[0].id, serviceProviderId: users[9].id, name: 'بوتاکس', description: 'تزریق بوتاکس', price: 3500000, duration: 30, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[0].id, serviceProviderId: users[9].id, name: 'فیلر لب', description: 'تزریق فیلر', price: 2800000, duration: 45, isActive: true, sortOrder: 2 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[1].id, serviceProviderId: users[10].id, name: 'کوتاهی مو', description: 'کوتاهی مو', price: 350000, duration: 30, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[1].id, serviceProviderId: users[10].id, name: 'رنگ مو', description: 'رنگ مو', price: 800000, duration: 90, isActive: true, sortOrder: 2 } }),
    prisma.service.create({ data: { organizationId: beautyClinic.id, categoryId: beautyCategories[2].id, serviceProviderId: users[12].id, name: 'میکاپ', description: 'آرایش', price: 500000, duration: 60, isActive: true, sortOrder: 1 } }),
  ]);

  // Dental Clinic Services
  const dentalCategories = await Promise.all([
    prisma.serviceCategory.create({ data: { organizationId: dentalClinic.id, name: 'خدمات دندان', description: 'دندانپزشکی', sortOrder: 1, isActive: true } }),
  ]);

  const dentalServices = await Promise.all([
    prisma.service.create({ data: { organizationId: dentalClinic.id, categoryId: dentalCategories[0].id, serviceProviderId: users[9].id, name: 'جرم‌گیری', description: 'جرم‌گیری دندان', price: 500000, duration: 30, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: dentalClinic.id, categoryId: dentalCategories[0].id, serviceProviderId: users[9].id, name: ' سفیدکردن', description: 'بلیچینگ', price: 1500000, duration: 60, isActive: true, sortOrder: 2 } }),
    prisma.service.create({ data: { organizationId: dentalClinic.id, categoryId: dentalCategories[0].id, serviceProviderId: users[9].id, name: 'کشیدن دندان', description: 'کشیدن دندان', price: 400000, duration: 30, isActive: true, sortOrder: 3 } }),
  ]);

  // SPA Services
  const spaCategories = await Promise.all([
    prisma.serviceCategory.create({ data: { organizationId: spaCenter.id, name: 'ماساژ', description: 'انواع ماساژ', sortOrder: 1, isActive: true } }),
  ]);

  const spaServices = await Promise.all([
    prisma.service.create({ data: { organizationId: spaCenter.id, categoryId: spaCategories[0].id, serviceProviderId: users[11].id, name: 'ماساژ سوئدی', description: 'ماساژ آرامش‌بخش', price: 1200000, duration: 60, isActive: true, sortOrder: 1 } }),
    prisma.service.create({ data: { organizationId: spaCenter.id, categoryId: spaCategories[0].id, serviceProviderId: users[11].id, name: 'ماساژ تایلندی', description: 'ماساژ تایلندی', price: 1500000, duration: 90, isActive: true, sortOrder: 2 } }),
    prisma.service.create({ data: { organizationId: spaCenter.id, categoryId: spaCategories[0].id, serviceProviderId: users[11].id, name: 'اسکراب بدن', description: 'لایه‌برداری', price: 900000, duration: 45, isActive: true, sortOrder: 3 } }),
  ]);

  console.log(`✅ Created service categories and services\n`);

  // ========================================
  // 9. CREATE APPOINTMENTS
  // ========================================
  console.log('📅 Creating appointments...');

  // Beauty Clinic Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[5].id,
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
      customerId: users[6].id,
      serviceId: beautyServices[2].id,
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.PENDING,
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[7].id,
      serviceId: beautyServices[3].id,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.PENDING,
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[5].id,
      serviceId: beautyServices[1].id,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000 + 45 * 60 * 1000),
      status: AppointmentStatus.COMPLETED,
    },
  });

  // Dental Clinic Appointments
  await prisma.appointment.create({
    data: {
      customerId: users[8].id,
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
      customerId: users[6].id,
      serviceId: spaServices[0].id,
      date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      status: AppointmentStatus.PENDING,
      notes: 'ماساژ آرامش‌بخش',
    },
  });

  await prisma.appointment.create({
    data: {
      customerId: users[7].id,
      serviceId: spaServices[1].id,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.COMPLETED,
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
      customerId: users[5].id,
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
      customerId: users[6].id,
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

  console.log('✅ Created orders\n');

  // ========================================
  // 11. CREATE REVIEWS
  // ========================================
  console.log('⭐ Creating reviews...');

  await prisma.review.create({
    data: { organizationId: beautyClinic.id, userId: users[5].id, rating: 5, comment: 'عالی بود', isVerifiedPurchase: true },
  });

  await prisma.review.create({
    data: { organizationId: healthShop.id, userId: users[6].id, rating: 4, comment: 'خوب بود', isVerifiedPurchase: true },
  });

  await prisma.review.create({
    data: { organizationId: spaCenter.id, userId: users[7].id, rating: 5, comment: 'عالی بود', isVerifiedPurchase: true },
  });

  console.log('✅ Created reviews\n');

  // ========================================
  // 12. CREATE FOLLOWS
  // ========================================
  console.log('❤️ Creating follows...');

  await prisma.follow.create({ data: { organizationId: beautyClinic.id, customerId: users[5].id } });
  await prisma.follow.create({ data: { organizationId: healthShop.id, customerId: users[6].id } });
  await prisma.follow.create({ data: { organizationId: spaCenter.id, customerId: users[7].id } });

  console.log('✅ Created follows\n');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${users.length} users (SUPER_ADMIN, ADMIN, MANAGER, STAFF, DRIVER, CUSTOMER)`);
  console.log(`   - 6 organizations (3 SHOP, 3 APPOINTMENT)`);
  console.log(`   - All OrgMemberRole types: ADMIN, MANAGER, STAFF`);
  console.log('\n🔑 Test Credentials:');
  console.log('   - Super Admin: superadmin@example.com / password123');
  console.log('   - Admin: admin@shop.ir / password123');
  console.log('   - Manager: manager@clinic.ir / password123');
  console.log('   - Customer: customer1@example.com / password123');
  console.log('   - Service Provider: dr.dermatologist@clinic.ir / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
