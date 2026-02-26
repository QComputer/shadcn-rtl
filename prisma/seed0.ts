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
  // 1. CREATE USERS
  // ========================================
  console.log('👤 Creating users...');

  const hashedPassword = await bcrypt.hash('password123', 12);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'آدمین',
        lastName: 'اصلی',
        name: 'آدمین اصلی',
        phone: '+989123456789',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'dark',
      },
    }),
    prisma.user.create({
      data: {
        email: 'manager@shop.ir',
        password: hashedPassword,
        firstName: 'محمد',
        lastName: 'رحیمی',
        name: 'محمد رحیمی',
        phone: '+989123456790',
        role: UserRole.ADMIN,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    prisma.user.create({
      data: {
        email: 'staff@shop.ir',
        password: hashedPassword,
        firstName: 'سارا',
        lastName: 'احمدی',
        name: 'سارا احمدی',
        phone: '+989123456791',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    prisma.user.create({
      data: {
        email: 'driver@shop.ir',
        password: hashedPassword,
        firstName: 'علی',
        lastName: 'محمدی',
        name: 'علی محمدی',
        phone: '+989123456792',
        role: UserRole.DRIVER,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer1@example.com',
        password: hashedPassword,
        firstName: 'مریم',
        lastName: 'کاظمی',
        name: 'مریم کاظمی',
        phone: '+989123456793',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer2@example.com',
        password: hashedPassword,
        firstName: 'رضا',
        lastName: 'طالبی',
        name: 'رضا طالبی',
        phone: '+989123456794',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'dark',
      },
    }),
    prisma.user.create({
      data: {
        email: 'customer3@example.com',
        password: hashedPassword,
        firstName: 'زهرا',
        lastName: 'رضایی',
        name: 'زهرا رضایی',
        phone: '+989123456795',
        role: UserRole.CUSTOMER,
        isActive: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
    prisma.user.create({
      data: {
        email: 'provider@example.com',
        password: hashedPassword,
        firstName: 'دکتر',
        lastName: 'ویزیت',
        name: 'دکتر ویزیت',
        phone: '+989123456796',
        role: UserRole.STAFF,
        isActive: true,
        isTeamMember: true,
        locale: 'fa',
        theme: 'light',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users\n`);

  // ========================================
  // 2. CREATE ORGANIZATIONS
  // ========================================
  console.log('🏢 Creating organizations...');

  // SHOP Organization
  const shopOrg = await prisma.organization.create({
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

  // APPOINTMENT Organization
  const appointmentOrg = await prisma.organization.create({
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

  // Another SHOP Organization
  const foodOrg = await prisma.organization.create({
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

  console.log(`✅ Created 3 organizations\n`);

  // ========================================
  // 3. CREATE ORGANIZATION MEMBERS
  // ========================================
  console.log('👥 Creating organization members...');

  // Shop org members
  await prisma.organizationMember.create({
    data: {
      organizationId: shopOrg.id,
      userId: users[1].id, // manager
      role: OrgMemberRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: shopOrg.id,
      userId: users[2].id, // staff
      role: OrgMemberRole.STAFF,
      isActive: true,
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: shopOrg.id,
      userId: users[3].id, // driver
      role: OrgMemberRole.STAFF,
      isActive: true,
    },
  });

  // Appointment org members
  await prisma.organizationMember.create({
    data: {
      organizationId: appointmentOrg.id,
      userId: users[1].id,
      role: OrgMemberRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: appointmentOrg.id,
      userId: users[7].id, // provider
      role: OrgMemberRole.STAFF,
      isActive: true,
    },
  });

  // Food org members
  await prisma.organizationMember.create({
    data: {
      organizationId: foodOrg.id,
      userId: users[1].id,
      role: OrgMemberRole.ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Created organization members\n');

  // ========================================
  // 4. CREATE BUSINESS HOURS
  // ========================================
  console.log('🕐 Creating business hours...');

  const days: DayOfWeek[] = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY];
  
  for (const org of [shopOrg, appointmentOrg, foodOrg]) {
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
    // Friday closed
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
      organizationId: shopOrg.id,
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
      organizationId: appointmentOrg.id,
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
      organizationId: foodOrg.id,
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

  console.log('✅ Created organization settings\n');

  // ========================================
  // 6. CREATE PRODUCT CATEGORIES (SHOP)
  // ========================================
  console.log('📦 Creating product categories...');

  const shopCategories = await Promise.all([
    prisma.productCategory.create({
      data: {
        organizationId: shopOrg.id,
        name: 'مکمل‌های غذایی',
        description: 'انواع مکمل‌های ویتامینی و معدنی',
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.productCategory.create({
      data: {
        organizationId: shopOrg.id,
        name: 'محصولات پوستی',
        description: 'کرم‌ها و لوسیون‌های مراقبت از پوست',
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.productCategory.create({
      data: {
        organizationId: shopOrg.id,
        name: 'تجهیزات پزشکی',
        description: 'دستگاه‌ها و ابزارهای پزشکی خانگی',
        sortOrder: 3,
        isActive: true,
      },
    }),
  ]);

  const foodCategories = await Promise.all([
    prisma.productCategory.create({
      data: {
        organizationId: foodOrg.id,
        name: 'غذاهای اصلی',
        description: 'انواع غذاهای ایرانی و فرنگی',
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.productCategory.create({
      data: {
        organizationId: foodOrg.id,
        name: 'پیش غذا',
        description: 'سالاد، سوپ و مخلفات',
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.productCategory.create({
      data: {
        organizationId: foodOrg.id,
        name: 'نوشیدنی‌ها',
        description: 'انواع نوشیدنی سرد و گرم',
        sortOrder: 3,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${shopCategories.length + foodCategories.length} product categories\n`);

  // ========================================
  // 7. CREATE PRODUCTS & VARIANTS
  // ========================================
  console.log('🛍️ Creating products and variants...');

  // Health shop products
  const products = await Promise.all([
    // Supplements
    prisma.product.create({
      data: {
        organizationId: shopOrg.id,
        categoryId: shopCategories[0].id,
        name: 'قرص مولتی ویتامین',
        description: 'مولتی ویتامین مینرال برای تمامی سنین با بهترین کیفیت',
        basePrice: 450000,
        sku: 'SUP-001',
        images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400'],
        trackInventory: true,
        lowStockThreshold: 20,
        isActive: true,
        sortOrder: 1,
        variants: {
          create: [
            { name: '۳۰ عددی', price: 450000, inventory: 100, sku: 'SUP-001-30' },
            { name: '۶۰ عددی', price: 800000, inventory: 50, sku: 'SUP-001-60' },
            { name: '۹۰ عددی', price: 1100000, inventory: 30, sku: 'SUP-001-90' },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        organizationId: shopOrg.id,
        categoryId: shopCategories[0].id,
        name: 'کپسول امگا ۳',
        description: 'روغن ماهی خالص با دوز بالای DHA و EPA',
        basePrice: 380000,
        sku: 'SUP-002',
        images: ['https://images.unsplash.com/photo-1550572017-edd951b55104?w=400'],
        trackInventory: true,
        lowStockThreshold: 15,
        isActive: true,
        sortOrder: 2,
        variants: {
          create: [
            { name: '۶۰ عددی', price: 380000, inventory: 80, sku: 'SUP-002-60' },
            { name: '۱۲۰ عددی', price: 680000, inventory: 40, sku: 'SUP-002-120' },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        organizationId: shopOrg.id,
        categoryId: shopCategories[0].id,
        name: 'پودر پروتئین',
        description: 'پروتئین وی برای عضله‌سازی و سلامتی',
        basePrice: 1200000,
        sku: 'SUP-003',
        images: ['https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400'],
        trackInventory: true,
        lowStockThreshold: 10,
        isActive: true,
        sortOrder: 3,
        variants: {
          create: [
            { name: 'وانیلی ۱ کیلو', price: 1200000, inventory: 25, sku: 'SUP-003-V1' },
            { name: 'شکلاتی ۱ کیلو', price: 1200000, inventory: 25, sku: 'SUP-003-C1' },
            { name: 'وانیلی ۲.۵ کیلو', price: 2800000, inventory: 10, sku: 'SUP-003-V2' },
          ],
        },
      },
    }),
    // Skin care
    prisma.product.create({
      data: {
        organizationId: shopOrg.id,
        categoryId: shopCategories[1].id,
        name: 'کرم مرطوب‌کننده',
        description: 'کرم مرطوب‌کننده و آبرسان پوست حساس',
        basePrice: 320000,
        sku: 'SKN-001',
        images: ['https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400'],
        trackInventory: true,
        lowStockThreshold: 30,
        isActive: true,
        sortOrder: 1,
        variants: {
          create: [
            { name: '۵۰ میل', price: 320000, inventory: 120, sku: 'SKN-001-50' },
            { name: '۱۰۰ میل', price: 550000, inventory: 60, sku: 'SKN-001-100' },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        organizationId: shopOrg.id,
        categoryId: shopCategories[1].id,
        name: 'کرم ضد آفتاب',
        description: 'ضد آفتاب بدون SLS با SPF 50+',
        basePrice: 280000,
        sku: 'SKN-002',
        images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400'],
        trackInventory: true,
        lowStockThreshold: 25,
        isActive: true,
        sortOrder: 2,
        variants: {
          create: [
            { name: 'SPF 30', price: 250000, inventory: 80, sku: 'SKN-002-30' },
            { name: 'SPF 50', price: 280000, inventory: 100, sku: 'SKN-002-50' },
            { name: 'SPF 50+', price: 320000, inventory: 60, sku: 'SKN-002-50P' },
          ],
        },
      },
    }),
    // Medical equipment
    prisma.product.create({
      data: {
        organizationId: shopOrg.id,
        categoryId: shopCategories[2].id,
        name: 'فشارسنج دیجیتال',
        description: 'فشارسنج دیجیتال بازویی با دقت بالا',
        basePrice: 850000,
        sku: 'MED-001',
        images: ['https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400'],
        trackInventory: true,
        lowStockThreshold: 5,
        isActive: true,
        sortOrder: 1,
        variants: {
          create: [
            { name: 'استاندارد', price: 850000, inventory: 15, sku: 'MED-001-STD' },
            { name: 'پرمیوم', price: 1200000, inventory: 8, sku: 'MED-001-PRM' },
          ],
        },
      },
    }),
  ]);

  // Food products
  const foodProducts = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[0].id,
        name: 'چلو کباب کوبیده',
        description: 'چلو کباب کوبیده با گوشت تازه و ریش‌ریش شده',
        basePrice: 350000,
        sku: 'FOOD-001',
        images: ['https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400'],
        trackInventory: true,
        lowStockThreshold: 10,
        isActive: true,
        sortOrder: 1,
        variants: {
          create: [
            { name: 'یک سیخ', price: 350000, inventory: 50, sku: 'FOOD-001-1' },
            { name: 'دو سیخ', price: 650000, inventory: 30, sku: 'FOOD-001-2' },
          ],
        },
      },
    }),
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[0].id,
        name: 'قورمه سبزی',
        description: 'قورمه سبزی با روغن حیوانی و لیمو امانی',
        basePrice: 280000,
        sku: 'FOOD-002',
        images: ['https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400'],
        trackInventory: true,
        lowStockThreshold: 15,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[0].id,
        name: 'جوجه کباب',
        description: 'جوجه کباب با ادویه مخصوص و زعفران',
        basePrice: 320000,
        sku: 'FOOD-003',
        images: ['https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400'],
        trackInventory: true,
        lowStockThreshold: 10,
        isActive: true,
        sortOrder: 3,
        variants: {
          create: [
            { name: 'نصف مرغ', price: 320000, inventory: 25, sku: 'FOOD-003-H' },
            { name: 'یک مرغ', price: 600000, inventory: 15, sku: 'FOOD-003-F' },
          ],
        },
      },
    }),
    // Appetizers
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[1].id,
        name: 'سالاد فصل',
        description: 'سالاد تازه با روغن زیتون و لیمو',
        basePrice: 85000,
        sku: 'FOOD-004',
        images: ['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400'],
        trackInventory: true,
        lowStockThreshold: 20,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[1].id,
        name: 'سوپ روز',
        description: 'سوپ روزانه با مواد تازه',
        basePrice: 65000,
        sku: 'FOOD-005',
        images: ['https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400'],
        trackInventory: true,
        lowStockThreshold: 30,
        isActive: true,
        sortOrder: 2,
      },
    }),
    // Beverages
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[2].id,
        name: 'دوغ سنتی',
        description: 'دوغ سنتی بدون گاز',
        basePrice: 35000,
        sku: 'DRK-001',
        images: ['https://images.unsplash.com/photo-1603569283847-aa295f0d016a?w=400'],
        trackInventory: true,
        lowStockThreshold: 50,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: foodOrg.id,
        categoryId: foodCategories[2].id,
        name: 'چای نعنا',
        description: 'چای تازه با نعنای خشک',
        basePrice: 25000,
        sku: 'DRK-002',
        images: ['https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400'],
        trackInventory: true,
        lowStockThreshold: 40,
        isActive: true,
        sortOrder: 2,
      },
    }),
  ]);

  console.log(`✅ Created ${products.length + foodProducts.length} products with variants\n`);

  // ========================================
  // 8. CREATE SERVICE CATEGORIES & SERVICES (APPOINTMENT)
  // ========================================
  console.log('💅 Creating service categories and services...');

  const serviceCategories = await Promise.all([
    prisma.serviceCategory.create({
      data: {
        organizationId: appointmentOrg.id,
        name: 'خدمات پوست',
        description: 'خدمات تخصصی پوست و زیبایی',
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: appointmentOrg.id,
        name: 'خدمات مو',
        description: 'کوتاهی، رنگ و میکاپ',
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.serviceCategory.create({
      data: {
        organizationId: appointmentOrg.id,
        name: 'ماساژ و اسپا',
        description: 'ماساژ درمانی و آرامش‌بخش',
        sortOrder: 3,
        isActive: true,
      },
    }),
  ]);

  const services = await Promise.all([
    // Skin services
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[0].id,
        serviceProviderId: users[7].id,
        name: 'بوتاکس',
        description: 'تزریق بوتاکس برای رفع چین و چروک',
        price: 3500000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[0].id,
        serviceProviderId: users[7].id,
        name: 'فیلر لب',
        description: 'تزریق فیلر برای حجیم‌سازی لب',
        price: 2800000,
        duration: 45,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[0].id,
        serviceProviderId: users[7].id,
        name: 'لیزر مو',
        description: 'لیزر موهای زائد با دستگاه الکساندرایت',
        price: 500000,
        duration: 60,
        isActive: true,
        sortOrder: 3,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[0].id,
        serviceProviderId: users[7].id,
        name: 'میکرونیدلینگ',
        description: 'جوانسازی پوست با میکرونیدلینگ',
        price: 1500000,
        duration: 45,
        isActive: true,
        sortOrder: 4,
      },
    }),
    // Hair services
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[1].id,
        serviceProviderId: users[7].id,
        name: 'کوتاهی مو',
        description: 'کوتاهی مو با مدل‌های جدید',
        price: 350000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[1].id,
        serviceProviderId: users[7].id,
        name: 'رنگ مو',
        description: 'رنگ مو با بهترین برندها',
        price: 800000,
        duration: 90,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[1].id,
        serviceProviderId: users[7].id,
        name: 'باندو مو',
        description: 'باندو مو برای حالت‌دهی',
        price: 600000,
        duration: 60,
        isActive: true,
        sortOrder: 3,
      },
    }),
    // Spa services
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[2].id,
        serviceProviderId: users[7].id,
        name: 'ماساژ سوئدی',
        description: 'ماساژ آرامش‌بخش سوئدی ۶۰ دقیقه‌ای',
        price: 1200000,
        duration: 60,
        isActive: true,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[2].id,
        serviceProviderId: users[7].id,
        name: 'اسکراب بدن',
        description: 'پاکسازی و لایه‌برداری پوست بدن',
        price: 900000,
        duration: 45,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        organizationId: appointmentOrg.id,
        categoryId: serviceCategories[2].id,
        serviceProviderId: users[7].id,
        name: 'فیشیال',
        description: 'پاکسازی و مراقبت پوست صورت',
        price: 1100000,
        duration: 60,
        isActive: true,
        sortOrder: 3,
      },
    }),
  ]);

  console.log(`✅ Created ${serviceCategories.length} service categories and ${services.length} services\n`);

  // ========================================
  // 9. CREATE CARTS
  // ========================================
  console.log('🛒 Creating carts...');

  // Get product variants
  const allVariants = await prisma.productVariant.findMany();

  const cart1 = await prisma.shopCart.create({
    data: {
      organizationId: shopOrg.id,
      customerId: users[4].id, // customer1
      status: CartStatus.ACTIVE,
      items: {
        create: [
          { variantId: allVariants[0].id, quantity: 2 },
          { variantId: allVariants[3].id, quantity: 1 },
        ],
      },
    },
  });

  const cart2 = await prisma.shopCart.create({
    data: {
      organizationId: foodOrg.id,
      customerId: users[5].id, // customer2
      status: CartStatus.ACTIVE,
      items: {
        create: [
          { variantId: allVariants.find(v => v.sku === 'FOOD-001-2')?.id || allVariants[9].id, quantity: 1 },
          { variantId: allVariants.find(v => v.sku === 'FOOD-004')?.id || allVariants[13].id, quantity: 2 },
        ],
      },
    },
  });

  console.log('✅ Created carts\n');

  // ========================================
  // 10. CREATE ORDERS
  // ========================================
  console.log('📋 Creating orders...');

  // Get some product data for orders
  const healthProducts = await prisma.product.findMany({ where: { organizationId: shopOrg.id }, include: { variants: true } });
  const foodProductsList = await prisma.product.findMany({ where: { organizationId: foodOrg.id }, include: { variants: true } });

  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-1404-0001',
      organizationId: shopOrg.id,
      customerId: users[4].id,
      type: OrderType.DELIVERY,
      status: OrderStatus.DELIVERED,
      subtotal: 1280000,
      deliveryFee: 50000,
      tax: 115200,
      discount: 0,
      total: 1445200,
      deliveryAddress: 'تهران، خیابان ولیعصر، پلاک ۴۵، واحد ۳',
      notes: 'لطفا زنگ در را بزنید',
      paidAt: new Date(),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      deliveredAt: new Date(),
      items: {
        create: [
          { productId: healthProducts[0].id, variantId: healthProducts[0].variants[0].id, quantity: 2, price: 450000, discount: 0 },
          { productId: healthProducts[3].id, variantId: healthProducts[3].variants[0].id, quantity: 1, price: 320000, discount: 0 },
        ],
      },
    },
  });

  const order2 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-1404-0002',
      organizationId: foodOrg.id,
      customerId: users[5].id,
      type: OrderType.DELIVERY,
      status: OrderStatus.PREPARING,
      subtotal: 730000,
      deliveryFee: 30000,
      tax: 65700,
      discount: 50000,
      total: 778700,
      deliveryAddress: 'تهران، خیابان انقلاب، پلاک ۸۸',
      estimatedDeliveryTime: new Date(Date.now() + 45 * 60000),
      items: {
        create: [
          { productId: foodProductsList[0].id, variantId: foodProductsList[0].variants[1].id, quantity: 1, price: 650000, discount: 0 },
          { productId: foodProductsList[3].id, variantId: foodProductsList[3].variants[0]?.id || null, quantity: 2, price: 85000, discount: 0 },
        ],
      },
    },
  });

  const order3 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-1404-0003',
      organizationId: foodOrg.id,
      customerId: users[6].id,
      type: OrderType.PICK_UP,
      status: OrderStatus.READY,
      subtotal: 320000,
      deliveryFee: 0,
      tax: 28800,
      total: 348800,
      notes: 'بدون پیاز',
      paidAt: new Date(),
      paymentMethod: PaymentMethod.CASH,
      items: {
        create: [
          { productId: foodProductsList[2].id, variantId: foodProductsList[2].variants[0]?.id || null, quantity: 1, price: 320000, discount: 0 },
        ],
      },
    },
  });

  // Create payments
  await prisma.payment.create({
    data: {
      orderId: order1.id,
      amount: 1445200,
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.COMPLETED,
      transactionId: 'TXN-' + Math.random().toString(36).substring(7).toUpperCase(),
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order2.id,
      amount: 778700,
      method: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.COMPLETED,
      transactionId: 'TXN-' + Math.random().toString(36).substring(7).toUpperCase(),
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order3.id,
      amount: 348800,
      method: PaymentMethod.CASH,
      status: PaymentStatus.COMPLETED,
    },
  });

  console.log('✅ Created orders with payments\n');

  // ========================================
  // 11. CREATE APPOINTMENTS
  // ========================================
  console.log('📅 Creating appointments...');

  const appointment1 = await prisma.appointment.create({
    data: {
      customerId: users[4].id,
      serviceId: services[0].id, // Botox
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      notes: 'اولین بار است که بوتاکس می‌کنم',
    },
  });

  const appointment2 = await prisma.appointment.create({
    data: {
      customerId: users[5].id,
      serviceId: services[4].id, // Haircut
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: AppointmentStatus.PENDING,
    },
  });

  const appointment3 = await prisma.appointment.create({
    data: {
      customerId: users[6].id,
      serviceId: services[7].id, // Swedish massage
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
      status: AppointmentStatus.PENDING,
      notes: 'ترجیحا ماساژور خانم',
    },
  });

  const appointment4 = await prisma.appointment.create({
    data: {
      customerId: users[4].id,
      serviceId: services[2].id, // Laser
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
      status: AppointmentStatus.COMPLETED,
    },
  });

  console.log('✅ Created appointments\n');

  // ========================================
  // 12. CREATE REVIEWS
  // ========================================
  console.log('⭐ Creating reviews...');

  await prisma.review.create({
    data: {
      organizationId: shopOrg.id,
      userId: users[4].id,
      rating: 5,
      comment: 'محصولات بسیار با کیفیت و ارسال سریع. واقعا راضی هستم',
      isVerifiedPurchase: true,
    },
  });

  await prisma.review.create({
    data: {
      organizationId: shopOrg.id,
      userId: users[5].id,
      rating: 4,
      comment: 'کیفیت خوبی دارند ولی قیمت‌ها کمی بالاست',
      isVerifiedPurchase: true,
    },
  });

  await prisma.review.create({
    data: {
      organizationId: appointmentOrg.id,
      userId: users[4].id,
      rating: 5,
      comment: 'بهترین کلینیک زیبایی که تا حالا رفتم. پرسنل بسیار محترم و حرفه‌ای',
      isVerifiedPurchase: true,
    },
  });

  await prisma.review.create({
    data: {
      organizationId: foodOrg.id,
      userId: users[6].id,
      rating: 5,
      comment: 'غذاها عالی بودن، مخصوصا کباب کوبیده. حتما سفارش می‌دهم',
      isVerifiedPurchase: true,
    },
  });

  console.log('✅ Created reviews\n');

  // ========================================
  // 13. CREATE FOLLOWS
  // ========================================
  console.log('❤️ Creating follows...');

  await prisma.follow.create({
    data: {
      organizationId: shopOrg.id,
      customerId: users[4].id,
    },
  });

  await prisma.follow.create({
    data: {
      organizationId: appointmentOrg.id,
      customerId: users[4].id,
    },
  });

  await prisma.follow.create({
    data: {
      organizationId: foodOrg.id,
      customerId: users[5].id,
    },
  });

  await prisma.follow.create({
    data: {
      organizationId: foodOrg.id,
      customerId: users[6].id,
    },
  });

  console.log('✅ Created follows\n');

  // ========================================
  // 14. CREATE CONVERSATIONS & MESSAGES
  // ========================================
  console.log('💬 Creating conversations and messages...');

  // Conversation 1
  const conv1 = await prisma.conversation.create({
    data: {
      type: 'direct',
      lastMessage: 'سفارش من کی می‌رسد؟',
      lastMessageAt: new Date(),
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conv1.id, userId: users[4].id, role: 'member' },
      { conversationId: conv1.id, userId: users[1].id, role: 'admin' },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv1.id,
        senderId: users[4].id,
        receiverId: users[1].id,
        content: 'سلام، سفارش دادم ولی هنوز نرسیده',
        isRead: true,
        readAt: new Date(),
      },
      {
        conversationId: conv1.id,
        senderId: users[1].id,
        receiverId: users[4].id,
        content: 'سلام، سفارش شما در حال آماده‌سازی است. حدود ۲۰ دقیقه دیگر می‌رسد',
        isRead: true,
        readAt: new Date(),
      },
      {
        conversationId: conv1.id,
        senderId: users[4].id,
        receiverId: users[1].id,
        content: 'سفارش من کی می‌رسد؟',
        isRead: false,
      },
    ],
  });

  // Conversation 2
  const conv2 = await prisma.conversation.create({
    data: {
      type: 'direct',
      lastMessage: 'بله، وقت دارم',
      lastMessageAt: new Date(),
    },
  });

  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conv2.id, userId: users[5].id, role: 'member' },
      { conversationId: conv2.id, userId: users[7].id, role: 'admin' },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv2.id,
        senderId: users[7].id,
        receiverId: users[5].id,
        content: 'سلام، برای فردا وقت رنگ مو دارید',
        isRead: true,
        readAt: new Date(),
      },
      {
        conversationId: conv2.id,
        senderId: users[5].id,
        receiverId: users[7].id,
        content: 'بله، وقت دارم',
        isRead: true,
        readAt: new Date(),
      },
    ],
  });

  console.log('✅ Created conversations and messages\n');

  // ========================================
  // 15. CREATE PROMOTIONS
  // ========================================
  console.log('🏷️ Creating promotions...');

  await prisma.promotion.create({
    data: {
      organizationId: shopOrg.id,
      code: 'WELCOME20',
      description: '۲۰٪ تخفیف برای اولین سفارش',
      discountType: 'percentage',
      discountValue: 20,
      minOrderAmount: 500000,
      maxUses: 100,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  await prisma.promotion.create({
    data: {
      organizationId: foodOrg.id,
      code: 'FREE_DELIVERY',
      description: 'ارسال رایگان برای سفارش بالای ۱ میلیون',
      discountType: 'fixed',
      discountValue: 30000,
      minOrderAmount: 1000000,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  });

  console.log('✅ Created promotions\n');

  // ========================================
  // 16. CREATE AUDIT LOGS
  // ========================================
  console.log('📝 Creating audit logs...');

  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entityType: 'Order',
      entityId: order1.id,
      description: 'سفارش جدید ایجاد شد',
      userId: users[4].id,
      organizationId: shopOrg.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'LOGIN',
      entityType: 'User',
      entityId: users[4].id,
      description: 'ورود موفقیت‌آمیز به سیستم',
      userId: users[4].id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entityType: 'Appointment',
      entityId: appointment1.id,
      description: 'نوبت جدید رزرو شد',
      userId: users[4].id,
    },
  });

  console.log('✅ Created audit logs\n');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${users.length} users`);
  console.log(`   - 3 organizations (1 SHOP, 1 APPOINTMENT, 1 SHOP)`);
  console.log(`   - ${shopCategories.length + foodCategories.length} product categories`);
  console.log(`   - ${products.length + foodProducts.length} products`);
  console.log(`   - ${allVariants.length} product variants`);
  console.log(`   - ${serviceCategories.length} service categories`);
  console.log(`   - ${services.length} services`);
  console.log(`   - 3 orders`);
  console.log(`   - 4 appointments`);
  console.log(`   - 4 reviews`);
  console.log(`   - 4 follows`);
  console.log(`   - 2 conversations`);
  console.log(`   - 5 messages`);
  console.log(`   - 2 promotions`);
  console.log('\n🔑 Test Credentials:');
  console.log('   - Super Admin: admin@example.com / password123');
  console.log('   - Admin: manager@shop.ir / password123');
  console.log('   - Customer: customer1@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
