-- BB-B2B-P11: backfill legacy custom-domain statuses after enum values commit.

UPDATE "OrganizationDomain"
  SET status = 'REQUESTED'
  WHERE status = 'PENDING';

UPDATE "OrganizationDomain"
  SET status = 'ERROR'
  WHERE status = 'FAILED';
