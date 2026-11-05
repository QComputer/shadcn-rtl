-- Provider batch acceptance is distinct from handset delivery. No existing rows are rewritten.
ALTER TABLE "CustomerAuthSmsOutbox" ADD COLUMN "providerMessageId" TEXT;
