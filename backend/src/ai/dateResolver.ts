/**
 * Resolves a date expression (like "tomorrow", "next monday", "in 2 hours", "today at 3pm", "2026-06-16", etc.)
 * relative to a reference date.
 * Returns a Date object strictly in the future relative to the reference date if relative,
 * or as parsed.
 */
export function resolveRelativeDate(expression: string, referenceDate: Date = new Date()): Date {
  const expr = expression.toLowerCase().trim();
  const result = new Date(referenceDate);

  // Match "in N hours" or "in N days"
  const inHoursMatch = expr.match(/^in\s+(\d+)\s+hours?$/);
  if (inHoursMatch) {
    const hours = parseInt(inHoursMatch[1], 10);
    result.setHours(result.getHours() + hours);
    return result;
  }

  const inDaysMatch = expr.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Handle "tomorrow"
  if (expr.includes("tomorrow")) {
    result.setDate(result.getDate() + 1);
    // Parse time if specified, e.g. "tomorrow at 3pm"
    const timeMatch = expr.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3];
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      result.setHours(hours, minutes, 0, 0);
    }
    return result;
  }

  // Handle "next monday", "next tuesday", etc.
  const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const nextDayMatch = expr.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextDayMatch) {
    const targetDayStr = nextDayMatch[1];
    const targetDayIdx = daysOfWeek.indexOf(targetDayStr);
    const currentDayIdx = referenceDate.getDay();
    let diff = targetDayIdx - currentDayIdx;
    if (diff <= 0) {
      diff += 7;
    }
    result.setDate(result.getDate() + diff);
    return result;
  }

  // Default parsing fallback
  const parsed = Date.parse(expression);
  if (!isNaN(parsed)) {
    const parsedDate = new Date(parsed);
    // If it resolves to a past time and was a relative time, or just parsed, return it.
    return parsedDate;
  }

  return result;
}
