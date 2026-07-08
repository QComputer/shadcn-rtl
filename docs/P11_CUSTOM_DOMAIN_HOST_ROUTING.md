# Custom Domain Host Routing

## proxy.ts: مسیریابی بر اساس هاست

### هدف
هدایت درخواست‌های دامنه‌های سفارشی به تجربه مستاجر (Tenant) بدون تغییر URL در مرورگر.

### مسیرها
- **Shop**: دامنه سفارشی → `/fa/shop/[slug]` → رندر تجربه فروشگاه
- **Appointment**: دامنه سفارشی → `/fa/appointment/[slug]` → رندر تجربه نوبت‌دهی

### هدرها درخواستی
- `x-bazar-custom-domain: true`
- `x-bazar-tenant-slug: <slug>`
- `x-bazar-tenant-organization-id: <id>`
- `x-bazar-tenant-organization-type: SHOP | APPOINTMENT`
- `x-bazar-tenant-public-path: <public path>`
- `x-bazar-tenant-public-locale: <locale>`

### جدول مسیریابی
| نوع مستاجر | دامنه فعال | مسیر داخلی |
|-----------|-----------|-----------|
| Shop | yes | `/fa/shop/[slug]/*` |
| Shop | no | `/{locale}/domain-not-configured` |
| Appointment | yes | `/fa/appointment/[slug]/*` |
| Appointment | no | `/{locale}/domain-not-configured` |

### محدودیت‌ها
- هاست‌های پلتفرم (`localhost`, `bazar-baz.ir`, ...) تحت این منطق قرار نمی‌گیرند.
- مسیرهای `/api`, `/_next`, `/uploads` و فایل‌های استاتیک از بازنویسی مستثنی هستند.
