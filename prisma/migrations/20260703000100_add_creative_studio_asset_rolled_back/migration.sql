-- Phase P120: add rollback action to Creative Studio usage events.

ALTER TYPE "CreativeStudioUsageAction" ADD VALUE IF NOT EXISTS 'ASSET_ROLLED_BACK';
