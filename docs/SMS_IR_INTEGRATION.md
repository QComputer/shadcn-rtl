# SMS.ir integration plan

Bazar Baz is planned to integrate with the `sms-ir-api` package from the uploaded `sms-ir-node` module. The integration must stay dry-run safe by default. Automated validation, local development, CI, and deployed smoke tests must never send real SMS unless real sending is explicitly enabled in production secret storage.

## Source package reviewed

Uploaded package: `sms-ir-node-main.zip`

Package metadata from the uploaded source:

- npm package name: `sms-ir-api`
- exported class: `Smsir`
- import style: `import { Smsir } from "sms-ir-api";`
- API base URL used by wrapper: `https://api.sms.ir/v1`
- auth header used by wrapper: `X-API-KEY`
- JSON accept/content headers are sent by the wrapper

Main methods found in the uploaded source:

- `Send(messageText, mobile, sendDateTime?, lineNumber?)`
- `SendBulk(messageText, mobiles, sendDateTime?, lineNumber?)`
- `SendLikeToLike(messageTexts, mobiles, sendDateTime?, lineNumber?)`
- `SendVerifyCode(mobile, templateId, parameters)`
- `DeleteScheduled(packId)`
- `ReportMessage(messageId)`
- `ReportPack(packId)`
- `ReportToday(...)`
- `ReportArchived(...)`
- `ReportLatestReceived(...)`
- `GetCredit()`
- `GetLineNumbers()`

## SMS.ir REST contract notes

The SMS.ir documentation provided for this phase says:

- requests authenticate with `X-API-KEY` in the HTTP headers;
- `Accept` can be `application/json` or `application/xml`;
- relevant HTTP status codes include `200`, `400`, `401`, `429`, and `500`;
- system time values are Unix Time in UTC;
- response bodies follow a unified model with `status`, `message`, and `data`.

Never store real API keys in this repository, in docs, in smoke tests, in seed data, or in screenshots. If a real key is exposed in chat, logs, or a ZIP, rotate it in the SMS.ir developer panel and restrict the replacement key to the production server IP.

## Environment contract

Use the variables below. `.env.example` must contain only placeholders. Real values must be stored in production secret storage.

```env
SMS_PROVIDER=dry_run
SMS_DRY_RUN=true
SMS_IR_API_KEY=
SMS_IR_LINE_NUMBER=
SMS_IR_VERIFY_TEMPLATE_ID=
```

Rules:

- `SMS_DRY_RUN=true` is the default for local/dev/test/CI.
- `SMS_PROVIDER=dry_run` means no external SMS.ir request is made.
- `SMS_PROVIDER=sms_ir` with `SMS_DRY_RUN=false` requires `SMS_IR_API_KEY` and `SMS_IR_LINE_NUMBER`.
- Real SMS sending should only be enabled in production by environment configuration.
- The API key should be IP-restricted in the SMS.ir panel.

## Recommended Bazar Baz abstraction

Do not import `Smsir` directly inside route handlers or business workflows. Create a provider boundary first:

```txt
lib/sms/sms.types.ts
lib/sms/sms-provider.ts
lib/sms/sms-dry-run-provider.ts
lib/sms/sms-ir-provider.ts
lib/sms/index.ts
```

Recommended interface:

```ts
export type SmsPurpose =
  | "phone_verification"
  | "appointment_confirmation"
  | "appointment_reminder"
  | "order_created"
  | "order_status_updated"
  | "payment_status_updated"
  | "staff_alert";

export interface SmsSendResult {
  ok: boolean;
  provider: "dry_run" | "sms_ir";
  dryRun: boolean;
  messageId?: string | number;
  packId?: string | number;
  status?: number;
  message?: string;
  error?: string;
}

export interface SmsProvider {
  sendText(input: {
    to: string;
    message: string;
    purpose: SmsPurpose;
    correlationId?: string;
  }): Promise<SmsSendResult>;

  sendVerifyCode(input: {
    to: string;
    templateId: number;
    parameters: { name: string; value: string }[];
    purpose: SmsPurpose;
    correlationId?: string;
  }): Promise<SmsSendResult>;
}
```

## Planned workflow uses

Add SMS only after the provider abstraction and dry-run validation are in place. Candidate workflows:

1. phone verification during registration/login;
2. appointment confirmation and reminder;
3. order placed notification;
4. order status update notification;
5. payment confirmation/failure notification;
6. staff/admin operational alert.

## Required safety tests

Before enabling real SMS integration, add tests that prove:

- dry-run mode records a simulated send without calling SMS.ir;
- live mode refuses to start without required env variables;
- real send is not possible in CI/deployed smoke tests unless explicitly enabled;
- phone numbers are masked in logs;
- API keys are never returned by health endpoints, errors, or logs.
