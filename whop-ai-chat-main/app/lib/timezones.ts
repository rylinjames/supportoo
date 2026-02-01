/**
 * Timezone utilities
 *
 * Common timezones for user selection and timezone detection.
 */

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

// Common timezones for the dropdown
export const COMMON_TIMEZONES: TimezoneOption[] = [
  {
    value: "America/New_York",
    label: "Eastern Time (EST/EDT)",
    offset: "UTC-5/4",
  },
  {
    value: "America/Chicago",
    label: "Central Time (CST/CDT)",
    offset: "UTC-6/5",
  },
  {
    value: "America/Denver",
    label: "Mountain Time (MST/MDT)",
    offset: "UTC-7/6",
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time (PST/PDT)",
    offset: "UTC-8/7",
  },
  {
    value: "America/Anchorage",
    label: "Alaska Time (AKST/AKDT)",
    offset: "UTC-9/8",
  },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii Time (HST)",
    offset: "UTC-10",
  },
  {
    value: "Europe/London",
    label: "London (GMT/BST)",
    offset: "UTC+0/1",
  },
  {
    value: "Europe/Paris",
    label: "Paris (CET/CEST)",
    offset: "UTC+1/2",
  },
  {
    value: "Europe/Berlin",
    label: "Berlin (CET/CEST)",
    offset: "UTC+1/2",
  },
  {
    value: "Asia/Tokyo",
    label: "Tokyo (JST)",
    offset: "UTC+9",
  },
  {
    value: "Asia/Shanghai",
    label: "Shanghai (CST)",
    offset: "UTC+8",
  },
  {
    value: "Asia/Dubai",
    label: "Dubai (GST)",
    offset: "UTC+4",
  },
  {
    value: "Australia/Sydney",
    label: "Sydney (AEDT/AEST)",
    offset: "UTC+11/10",
  },
];

/**
 * Detect user's timezone from browser
 *
 * Returns the user's timezone or a fallback.
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York"; // Fallback
  }
}
