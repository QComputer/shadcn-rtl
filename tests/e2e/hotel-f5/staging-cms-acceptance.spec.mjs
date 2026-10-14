import { randomUUID } from "node:crypto";
import { test, expect } from "playwright/test";
import { publicMediaApi, publicWebsiteApi, syntheticEditorial, websiteApiBase } from "./synthetic-fixtures.mjs";

test("F5 deployment denies requests without a Vercel SSO session", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const page = await context.newPage();
    const app = new URL(process.env.HOTEL_F5_APP_URL);
    const response = await page.goto(app.toString(), { waitUntil: "domcontentloaded" });
    const finalUrl = new URL(page.url());
    const blockedOrRedirectedToSso = Boolean(response && [401, 403].includes(response.status())) || finalUrl.origin !== app.origin;
    expect(blockedOrRedirectedToSso).toBe(true);
  } finally {
    await context.close();
  }
});

test("F5 synthetic author-to-publication workflow enforces RBAC, tenant and media boundaries", async ({ browser }) => {
  const env = process.env;
  const appUrl = new URL(env.HOTEL_F5_APP_URL);
  const appOrigin = appUrl.origin;
  const orgId = env.HOTEL_F5_ORGANIZATION_ID;
  const propertyId = env.HOTEL_F5_PROPERTY_ID;
  const propertySlug = env.HOTEL_F5_PROPERTY_SLUG;
  const cmsApi = websiteApiBase(orgId, propertyId);
  const targetRevisionsApi = `${cmsApi}/revisions`;
  const publicApiUrl = new URL(publicWebsiteApi(propertySlug), env.HOTEL_F5_PUBLIC_ORIGIN).toString();
  const tag = env.HOTEL_F5_FIXTURE_TAG;
  const content = syntheticEditorial(tag);
  const marker = `${tag}-${randomUUID().slice(0, 8)}`;
  const violations = [];
  const contexts = [];
  let reviewerPage;
  let publicationId;
  let publicationRevoked = false;
  let revisionId;

  const newContext = async () => {
    const context = await browser.newContext({
      extraHTTPHeaders: { "x-vercel-protection-bypass": env.HOTEL_F5_VERCEL_PROTECTION_BYPASS },
    });
    contexts.push(context);
    context.on("request", (request) => {
      if (/\/(availability|quotes?|holds|reservations|payments|checkout|inoti|sms|notifications)(\/|\?|$)/i.test(new URL(request.url()).pathname)) {
        violations.push(new URL(request.url()).pathname);
      }
    });
    return context;
  };
  const login = async (username, password, callbackPath) => {
    const context = await newContext();
    const page = await context.newPage();
    const callbackUrl = `${appOrigin}${callbackPath}`;
    await page.goto(`${appOrigin}/fa/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname.includes(callbackPath), { timeout: 30_000 });
    return { context, page };
  };
  const mutation = async (page, path, body = {}) => page.request.post(`${appOrigin}${path}`, {
    headers: { Origin: appOrigin, "Idempotency-Key": `f5-e2e-${randomUUID()}` },
    data: body,
  });
  const readRevisions = async (page) => {
    const response = await page.request.get(`${appOrigin}${targetRevisionsApi}`);
    expect(response.status()).toBe(200);
    return response.json();
  };
  const checkPublicState = async (expectedMode, expectedHeading) => {
    const response = await reviewerPage.request.get(publicApiUrl);
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.mode).toBe(expectedMode);
    if (expectedMode === "PUBLISHED") {
      expect(payload.content?.hero?.heading).toBe(expectedHeading);
      const serialized = JSON.stringify(payload);
      for (const sensitive of [orgId, propertyId, env.HOTEL_F5_AUTHOR_USERNAME]) expect(serialized).not.toContain(sensitive);
      expect(serialized).not.toMatch(/\b(rate|price|availability|guest|reservation|authorUserId|reviewerUserId)\b/i);
    } else {
      expect(payload.content).toBeNull();
      expect(JSON.stringify(payload)).not.toContain(marker);
    }
    return payload;
  };
  const unauthorizedApiCheck = async (page, path, body) => {
    const response = await mutation(page, path, body);
    expect(response.status()).toBe(403);
    const text = await response.text();
    expect(text).not.toContain(orgId);
    expect(text).not.toContain(propertyId);
    expect(text).not.toContain(marker);
  };

  try {
    const ssoContext = await newContext();
    const gateOff = await ssoContext.request.get(env.HOTEL_F5_PUBLIC_GATE_OFF_API_URL);
    expect(gateOff.status()).toBe(503);
    expect((await gateOff.json()).error).toBe("WEBSITE_DISABLED");

    for (const name of ["HOTEL_F5_UNKNOWN_DOMAIN_API_URL", "HOTEL_F5_INACTIVE_DOMAIN_API_URL", "HOTEL_F5_FOREIGN_DOMAIN_API_URL", "HOTEL_F5_CAPABILITY_DISABLED_API_URL"]) {
      const requestOptions = name === "HOTEL_F5_UNKNOWN_DOMAIN_API_URL"
        ? { headers: { host: env.HOTEL_F5_UNKNOWN_DOMAIN_HOST } }
        : name === "HOTEL_F5_CAPABILITY_DISABLED_API_URL"
          ? { headers: { host: env.HOTEL_F5_CAP_DISABLED_HOST } }
          : {};
      const response = await ssoContext.request.get(env[name], requestOptions);
      expect(response.status()).toBe(404);
      const text = await response.text();
      expect(text).not.toContain(marker);
      expect(text).not.toContain(orgId);
    }

    const author = await login(env.HOTEL_F5_AUTHOR_USERNAME, env.HOTEL_F5_AUTHOR_PASSWORD, `/fa/dashboard/hotel-website/${orgId}/${propertyId}`);
    const editorTab = author.page.getByRole("button", { name: "ویرایش محتوا", exact: true });
    if (!(await editorTab.isVisible().catch(() => false))) {
      const sessionResponse = await author.page.request.get(`${appOrigin}/api/auth/session`);
      const session = sessionResponse.ok() ? await sessionResponse.json() : null;
      const bodyText = (await author.page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 500);
      console.log("F5 dashboard diagnostic", JSON.stringify({
        path: new URL(author.page.url()).pathname,
        pageTitle: await author.page.title(),
        sessionStatus: sessionResponse.status(),
        sessionUserPresent: Boolean(session?.user?.id),
        sessionRole: session?.user?.role ?? null,
        sessionOrganizationMatches: session?.user?.organizationId === orgId,
        editorTabPresent: await editorTab.count(),
        bodyText,
      }));
    }
    await expect(editorTab).toBeVisible();
    await editorTab.click();
    const beforeCount = (await readRevisions(author.page)).length;
    const initialPublic = await author.page.request.get(publicApiUrl);
    expect(initialPublic.status()).toBe(200);
    expect((await initialPublic.json()).mode).toBe("UNPUBLISHED");

    const replayKey = `f5-e2e-replay-${randomUUID()}`;
    const replayPayload = {
      content: {
        title: { fa: `پیش‌نویس تکرارپذیری ${marker}` },
        hero: { heading: { fa: `عنوان تکرارپذیری ${marker}` } },
        introduction: { body: { fa: `داده مصنوعی آزمون idempotency ${marker}` } },
        sections: [],
        contact: {},
      },
      media: [],
    };
    const createReplayRequest = () => author.page.request.post(`${appOrigin}${cmsApi}/revisions`, {
      headers: { Origin: appOrigin, "Idempotency-Key": replayKey },
      data: replayPayload,
    });
    const firstReplayResponse = await createReplayRequest();
    const secondReplayResponse = await createReplayRequest();
    expect(firstReplayResponse.status()).toBe(201);
    expect(secondReplayResponse.status()).toBe(201);
    const firstReplayBody = await firstReplayResponse.json();
    const secondReplayBody = await secondReplayResponse.json();
    expect(firstReplayBody.replayed).toBe(false);
    expect(secondReplayBody.replayed).toBe(true);
    expect(secondReplayBody.result).toEqual(firstReplayBody.result);
    const replayConflict = await author.page.request.post(`${appOrigin}${cmsApi}/revisions`, {
      headers: { Origin: appOrigin, "Idempotency-Key": replayKey },
      data: { ...replayPayload, content: { ...replayPayload.content, title: { fa: "different request" } } },
    });
    expect(replayConflict.status()).toBe(409);
    expect((await readRevisions(author.page)).length).toBe(beforeCount + 1);

    const foreign = await login(env.HOTEL_F5_FOREIGN_USERNAME, env.HOTEL_F5_FOREIGN_PASSWORD, `/fa/dashboard/hotel-website/${orgId}/${propertyId}`);
    await expect(foreign.page.locator("body")).not.toContainText("ویرایش محتوا");
    const foreignRead = await foreign.page.request.get(`${appOrigin}${targetRevisionsApi}`);
    expect(foreignRead.status()).toBe(403);
    expect(await foreignRead.text()).not.toContain(orgId);
    await foreign.context.close();

    // Foreign-organization media must be rejected before a new revision is persisted.
    await editorTab.click();
    await author.page.getByLabel("عنوان صفحه", { exact: true }).fill(content.title + marker);
    await author.page.getByLabel("عنوان اصلی صفحه", { exact: true }).fill(content.heading + marker);
    await author.page.getByLabel("متن معرفی هتل", { exact: true }).fill(content.introduction);
    await author.page.getByRole("button", { name: "+ افزودن تصویر" }).click();
    await author.page.getByLabel("شناسه تصویر", { exact: true }).fill(env.HOTEL_F5_FOREIGN_MEDIA_IMAGE_ID);
    const invalidMediaResponsePromise = author.page.waitForResponse((response) => response.url().endsWith("/website/revisions") && response.request().method() === "POST");
    await author.page.getByRole("button", { name: "ثبت نسخه جدید" }).click();
    expect((await invalidMediaResponsePromise).status()).toBe(403);
    await expect(author.page.locator("p[role='alert']")).toBeVisible();
    expect((await readRevisions(author.page)).length).toBe(beforeCount);

    await author.page.getByRole("button", { name: "حذف تصویر" }).click();
    await author.page.getByRole("button", { name: "+ افزودن تصویر" }).click();
    await author.page.getByLabel("شناسه تصویر", { exact: true }).fill(env.HOTEL_F5_SYNTHETIC_MEDIA_ID);
    await author.page.getByLabel("متن جایگزین (فارسی)", { exact: true }).fill(content.altText);
    const createResponsePromise = author.page.waitForResponse((response) => response.url().endsWith("/website/revisions") && response.request().method() === "POST");
    await author.page.getByRole("button", { name: "ثبت نسخه جدید" }).click();
    expect((await createResponsePromise).status()).toBe(201);
    await expect(author.page.getByRole("status")).toContainText("نسخه جدید ذخیره شد");

    const revisions = await readRevisions(author.page);
    const created = revisions.find((item) => item.content?.hero?.heading?.fa === content.heading + marker);
    expect(created).toBeTruthy();
    revisionId = created.revisionId;
    expect(created.status).toBe("DRAFT");

    await author.page.getByRole("button", { name: "پیش‌نمایش ذخیره‌شده" }).click();
    await expect(author.page.getByText("پیش‌نمایش خصوصی · غیرقابل نمایش عمومی")).toBeVisible();
    await expect(author.page.getByRole("heading", { name: content.heading + marker })).toBeVisible();
    await expect(author.page.getByText(content.altText)).toBeVisible();

    const submitPath = `${cmsApi}/revisions/${encodeURIComponent(revisionId)}/submit`;
    await author.page.getByRole("button", { name: "ویرایش محتوا" }).click();
    await author.page.getByRole("button", { name: "ارسال برای بررسی" }).click();
    await expect(author.page.getByRole("status")).toContainText("نسخه برای بررسی ارسال شد");
    expect((await readRevisions(author.page)).find((item) => item.revisionId === revisionId).status).toBe("IN_REVIEW");

    await unauthorizedApiCheck(author.page, `${cmsApi}/revisions/${encodeURIComponent(revisionId)}/review`, { decision: "APPROVED" });

    const manager = await login(env.HOTEL_F5_MANAGER_USERNAME, env.HOTEL_F5_MANAGER_PASSWORD, `/fa/dashboard/hotel-website/${orgId}/${propertyId}`);
    await unauthorizedApiCheck(manager.page, `${cmsApi}/revisions/${encodeURIComponent(revisionId)}/review`, { decision: "APPROVED" });
    await unauthorizedApiCheck(manager.page, `${cmsApi}/revisions/${encodeURIComponent(revisionId)}/publish`);

    const reviewer = await login(env.HOTEL_F5_REVIEWER_USERNAME, env.HOTEL_F5_REVIEWER_PASSWORD, `/fa/dashboard/hotel-website/${orgId}/${propertyId}`);
    reviewerPage = reviewer.page;
    expect(reviewer.page.url()).toContain(`/fa/dashboard/hotel-website/${orgId}/${propertyId}`);
    const revisionButton = reviewer.page.locator('aside[aria-label="نسخه‌های محتوا"] button').filter({ hasText: `نسخه ${created.revisionNumber}` });
    await revisionButton.first().click();
    await reviewer.page.getByRole("button", { name: "ویرایش محتوا" }).click();
    await reviewer.page.getByRole("button", { name: "تأیید نسخه" }).click();
    await expect(reviewer.page.getByRole("status")).toContainText("نسخه تأیید شد");
    expect((await readRevisions(reviewer.page)).find((item) => item.revisionId === revisionId).status).toBe("APPROVED");

    const publishResponsePromise = reviewer.page.waitForResponse((response) => response.url().endsWith(`/revisions/${revisionId}/publish`) && response.request().method() === "POST");
    await reviewer.page.getByRole("button", { name: "انتشار نسخه تأییدشده" }).click();
    expect((await publishResponsePromise).status()).toBe(200);
    await expect(reviewer.page.getByRole("status")).toContainText("منتشر شد");
    const publishedRevisions = await readRevisions(reviewer.page);
    const publishedRevision = publishedRevisions.find((item) => item.revisionId === revisionId);
    publicationId = publishedRevision.publications.find((item) => !item.revokedAt)?.id;
    expect(publicationId).toBeTruthy();

    await unauthorizedApiCheck(manager.page, `${cmsApi}/publications/${encodeURIComponent(publicationId)}/revoke`, { reason: "negative authorization check" });
    const publishedPayload = await checkPublicState("PUBLISHED", content.heading + marker);
    expect(publishedPayload.propertyGallery).toHaveLength(1);
    const mediaPath = publishedPayload.propertyGallery[0].src;
    expect(mediaPath).toMatch(/^\/api\/hotel\/v1\/website\/media\/[A-Za-z0-9_-]+$/);
    const associationId = mediaPath.split("/").at(-1);
    const mediaResponse = await reviewer.page.request.get(new URL(publicMediaApi(associationId), env.HOTEL_F5_PUBLIC_ORIGIN).toString(), { maxRedirects: 0 });
    expect(mediaResponse.status()).toBe(302);
    expect(new URL(mediaResponse.headers().location).hostname).toMatch(/\.public\.blob\.vercel-storage\.com$/);
    const foreignMediaResponse = await reviewer.page.request.get(new URL(publicMediaApi(env.HOTEL_F5_FOREIGN_MEDIA_ASSOCIATION_ID), env.HOTEL_F5_PUBLIC_ORIGIN).toString(), { maxRedirects: 0 });
    expect(foreignMediaResponse.status()).toBe(404);

    const anonymousPublicContext = await newContext();
    const publicPage = await anonymousPublicContext.newPage();
    await publicPage.goto(env.HOTEL_F5_PUBLIC_PAGE_URL);
    await expect(publicPage.getByText(content.heading + marker)).toBeVisible();
    await expect(publicPage.getByText(/synthetic F5|تصویر مصنوعی تست F5|عکس واقعی هتل نیست/i)).toBeVisible();

    const revokeDialog = reviewer.page.waitForEvent("dialog");
    await reviewer.page.getByRole("button", { name: "لغو انتشار فعلی" }).click();
    (await revokeDialog).accept();
    await expect(reviewer.page.getByRole("status")).toContainText("انتشار لغو شد");
    publicationRevoked = true;
    await checkPublicState("UNPUBLISHED");
    await publicPage.reload();
    await expect(publicPage.getByText(content.heading + marker)).not.toBeVisible();
    await unauthorizedApiCheck(manager.page, `${cmsApi}/publications/${encodeURIComponent(publicationId)}/revoke`, { reason: "duplicate revoke must not succeed" });

    expect(violations).toEqual([]);
  } finally {
    if (publicationId && !publicationRevoked && reviewerPage) {
      try {
        await mutation(reviewerPage, `${cmsApi}/publications/${encodeURIComponent(publicationId)}/revoke`, { reason: "F5 synthetic acceptance cleanup" });
      } catch { /* Preserve the original failure; operator may clean the synthetic publication. */ }
    }
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  }
});
