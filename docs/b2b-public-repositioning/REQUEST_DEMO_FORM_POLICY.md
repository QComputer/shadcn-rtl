# Request Demo Form Policy

This document defines the safety rules for the B2B request-demo form.

## Current Implementation (P06)

- The request-demo form is implemented as a UI-only client-side form.
- Form fields are validated on the client.
- On submit, the form shows a success message without making any API call.
- No data is stored in the database in P06.
- No SMS is sent.
- No email is sent.

## Form Fields

- نام و نام خانوادگی
- نام کسب‌وکار
- نوع کسب‌وکار
- شماره تماس
- شهر
- توضیح کوتاه نیاز کسب‌وکار
- ترجیح زمان تماس
- تأییدیه رضایت

## Safety Rules

- Do not send real SMS from the request-demo form.
- Do not store sensitive personal data without explicit user consent and privacy policy.
- Do not expose form data to third parties.
- Do not require authentication for the request-demo page.
- Rate limiting should be added if the form is connected to a real API in the future.

## Future Lead Storage

If lead storage is implemented in a future phase:
- A dedicated lead model should be created with proper migration.
- The API must validate input, rate-limit requests, and avoid storing sensitive data unnecessarily.
- The form must not send SMS on submission.
- The form must not expose secrets.
