export const importHubLimits = {
  maxActiveJobsPerOrganization: 10,
  maxJobsPerOrganizationPerDay: 50,
  maxDraftsPerJob: 500,
  auditEventPageSize: 50,
  planReadinessMode: "admin-default-limits",
} as const

export type ImportHubLimitSnapshot = typeof importHubLimits & {
  activeJobCount: number
  jobsTodayCount: number
}

export function buildImportHubLimitSnapshot(input: {
  activeJobCount: number
  jobsTodayCount: number
}): ImportHubLimitSnapshot {
  return {
    ...importHubLimits,
    activeJobCount: input.activeJobCount,
    jobsTodayCount: input.jobsTodayCount,
  }
}
