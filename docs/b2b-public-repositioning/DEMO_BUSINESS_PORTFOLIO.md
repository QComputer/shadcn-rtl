# Demo Business Portfolio

This document describes the public demo portfolio for Bazar Baz B2B positioning.

## Purpose

The demo portfolio allows business owners to see example use cases for different business types. It is not a consumer-facing marketplace or shop directory.

## Route

- `/{locale}/demo`

## Content source

- `lib/content/b2b-demo-businesses.ts`

## Included demos

1. فروشگاه پوشاک نمونه
2. رستوران نمونه
3. داروخانه نمونه
4. مطب نمونه
5. مرکز خدماتی نمونه
6. سالن زیبایی نمونه
7. مرکز آموزشی نمونه
8. مرکز خدمات فنی نمونه

## Rules

- All demo entries must include the explicit label `نمونه نمایشی`.
- Demo pages must not expose real tenant data.
- Demo CTAs must lead to registration, demo request, or dashboard login.
- No consumer-discovery wording is allowed on demo pages.
- Demo data must remain dry-run/local-safe by default.
