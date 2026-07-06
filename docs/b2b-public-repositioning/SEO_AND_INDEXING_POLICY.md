# SEO and Indexing Policy

This document defines the SEO and indexing policy for Bazar Baz B2B public surfaces.

## Indexable Public B2B Pages

These pages are indexable and should have strong Persian B2B metadata:

- `/{locale}` — B2B homepage
- `/{locale}/demo` — demo portfolio
- `/{locale}/features` — feature pages
- `/{locale}/dashboard-showcase` — dashboard showcase
- `/{locale}/request-demo` — conversion funnel
- `/{locale}/contact` — contact/onboarding
- `/{locale}/pricing` — pricing explanation
- `/{locale}/trust` — trust and data ownership
- `/{locale}/privacy` — privacy notice
- `/{locale}/terms` — terms of service

## Indexing Rules

- B2B public pages: index, target business-owner Persian keywords.
- Tenant direct pages: index (customer-facing utility).
- Demo portfolio: index, marked as demo with structured data.
- Marketplace-like broad discovery APIs/pages: noindex or restricted per P05.
- Dashboard/auth APIs: do not expose in sitemap.
- Private dashboard routes: disallowed in robots.txt.

## Metadata Requirements

- Persian/fa metadata must be strong and B2B-focused.
- Avoid consumer marketplace keywords.
- Avoid ad-directory/social-network positioning.
- Emphasize:
  - پلتفرم مدیریت کسب‌وکار
  - خدمات آنلاین برای کسب‌وکارها
  - نوبت‌دهی آنلاین
  - مدیریت سفارش
  - باشگاه مشتریان
  - پیامک و اعلان
  - داشبورد فارسی
  - کسب‌وکارهای ایرانی

## Canonical and Alternates

- Use canonical URLs with locale alternates where supported.
- Avoid duplicate content across locale prefixes without alternates.

## Sitemap/Robots Review

- `app/robots.ts` already disallows `/api/` and `/dashboard/` paths.
- `app/sitemap.ts` includes tenant direct pages and should continue to do so.
- B2B public pages should be included in sitemap.
- Marketplace discovery endpoints (`/api/public/organizations`, `/api/public/search`) are not public pages and should not be in sitemap.

## Next Review

- P09 deployed acceptance should verify sitemap and robots behavior.
- P08 does not add third-party analytics without env gate.
