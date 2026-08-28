import { describe, expect, it } from "vitest";
import {
  COMPANY_TIME_ZONE,
  dateKey,
  daysBetween,
  formatDateShort,
  formatDateTime,
  formatInZone,
  formatTime,
  fromDateOnly,
  isEndOfDay,
  isStartOfDay,
  parseDateKey,
  parseTimeKey,
  zonedDate,
  zonedDateFromInput,
  zonedParts,
} from "@/lib/time-zone";

// Assertions below assume the default zone; the process TZ must not matter.
const EST = new Date("2026-01-15T14:30:00Z"); // Thu Jan 15 2026, 9:30 AM EST
const EDT = new Date("2026-07-04T13:00:00Z"); // Sat Jul 4 2026, 9:00 AM EDT
const LATE = new Date("2026-03-03T03:30:00Z"); // Mon Mar 2 2026, 10:30 PM EST

describe("COMPANY_TIME_ZONE", () => {
  it("defaults to Eastern", () => {
    expect(COMPANY_TIME_ZONE).toBe("America/New_York");
  });
});

describe("zonedParts", () => {
  it("reads an EST instant as Eastern wall-clock time", () => {
    expect(zonedParts(EST)).toEqual({ year: 2026, month: 0, day: 15, hour: 9, minute: 30, second: 0, weekday: 4 });
  });

  it("reads an EDT instant as Eastern wall-clock time", () => {
    expect(zonedParts(EDT)).toEqual({ year: 2026, month: 6, day: 4, hour: 9, minute: 0, second: 0, weekday: 6 });
  });

  it("moves a late-evening instant back to the previous Eastern day", () => {
    expect(zonedParts(LATE)).toMatchObject({ year: 2026, month: 2, day: 2, hour: 22, minute: 30, weekday: 1 });
  });

  it("reports midnight as hour 0", () => {
    expect(zonedParts(new Date("2026-03-03T05:00:00Z")).hour).toBe(0);
  });

  it("honours an explicit zone", () => {
    expect(zonedParts(LATE, "UTC")).toMatchObject({ month: 2, day: 3, hour: 3, minute: 30 });
  });
});

describe("dateKey", () => {
  it("formats the Eastern calendar date", () => {
    expect(dateKey(EST)).toBe("2026-01-15");
    expect(dateKey(EDT)).toBe("2026-07-04");
  });

  it("uses the Eastern day, not the UTC day, across the day boundary", () => {
    expect(dateKey(LATE)).toBe("2026-03-02");
  });

  it("round-trips through parseDateKey", () => {
    expect(parseDateKey(dateKey(LATE))).toEqual({ year: 2026, month: 2, day: 2 });
    expect(parseDateKey("2026-3-2")).toBeNull();
    expect(parseDateKey("not a date")).toBeNull();
  });
});

describe("parseTimeKey", () => {
  it("parses HH:MM and rejects out-of-range values", () => {
    expect(parseTimeKey("09:05")).toEqual({ hour: 9, minute: 5 });
    expect(parseTimeKey("23:59:00")).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeKey("24:00")).toBeNull();
    expect(parseTimeKey("")).toBeNull();
  });
});

describe("formatters", () => {
  it("formatTime renders Eastern clock time", () => {
    expect(formatTime(EST)).toBe("9:30 AM");
    expect(formatTime(EDT)).toBe("9:00 AM");
    expect(formatTime(LATE)).toBe("10:30 PM");
  });

  it("formatTime compact drops :00 only on whole hours", () => {
    expect(formatTime(EDT, { compact: true })).toBe("9 AM");
    expect(formatTime(EST, { compact: true })).toBe("9:30 AM");
  });

  it("formatDateShort renders the Eastern date", () => {
    expect(formatDateShort(LATE)).toBe("Mar 2");
    expect(formatDateShort(EDT)).toBe("Jul 4");
  });

  it("formatDateTime renders the full Eastern date with or without a time", () => {
    expect(formatDateTime(LATE, { allDay: true })).toBe("Monday, March 2, 2026");
    expect(formatDateTime(LATE)).toMatch(/^Monday, March 2, 2026(,| at) 10:30 PM$/);
  });

  it("formatInZone pins any option set to the zone", () => {
    expect(formatInZone(LATE, { month: "long", year: "numeric" })).toBe("March 2026");
    expect(formatInZone(LATE, { weekday: "long", month: "long", day: "numeric" })).toBe("Monday, March 2");
  });
});

describe("zonedDate", () => {
  it("round-trips EST wall-clock time to the right instant", () => {
    expect(zonedDate(2026, 0, 15, 9, 30).toISOString()).toBe(EST.toISOString());
    expect(zonedParts(zonedDate(2026, 0, 15, 9, 30))).toMatchObject({ year: 2026, month: 0, day: 15, hour: 9, minute: 30 });
  });

  it("round-trips EDT wall-clock time to the right instant", () => {
    expect(zonedDate(2026, 6, 4, 9).toISOString()).toBe(EDT.toISOString());
  });

  it("round-trips the day-boundary case", () => {
    expect(zonedDate(2026, 2, 2, 22, 30).toISOString()).toBe(LATE.toISOString());
    expect(dateKey(zonedDate(2026, 2, 2, 22, 30))).toBe("2026-03-02");
  });

  it("produces Eastern midnight, not UTC midnight", () => {
    expect(zonedDate(2026, 2, 3).toISOString()).toBe("2026-03-03T05:00:00.000Z");
    expect(zonedDate(2026, 7, 5).toISOString()).toBe("2026-08-05T04:00:00.000Z");
    expect(zonedDate(2026, 7, 5, 23, 59, 59).toISOString()).toBe("2026-08-06T03:59:59.000Z");
  });

  it("allows day overflow for stepping through dates", () => {
    expect(dateKey(zonedDate(2026, 0, 32))).toBe("2026-02-01");
    expect(dateKey(zonedDate(2026, 11, 31 + 1))).toBe("2027-01-01");
  });

  it("handles the spring-forward transition", () => {
    // Mar 8 2026: clocks jump from 2:00 EST to 3:00 EDT at 07:00Z.
    expect(zonedDate(2026, 2, 8, 1, 59).toISOString()).toBe("2026-03-08T06:59:00.000Z");
    expect(zonedDate(2026, 2, 8, 3, 0).toISOString()).toBe("2026-03-08T07:00:00.000Z");
    expect(zonedDate(2026, 2, 8, 12, 0).toISOString()).toBe("2026-03-08T16:00:00.000Z");
    // 2:30 does not exist; land on the later reading like the local Date constructor.
    expect(zonedDate(2026, 2, 8, 2, 30).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("handles the fall-back transition", () => {
    // Nov 1 2026: clocks fall from 2:00 EDT to 1:00 EST at 06:00Z.
    expect(zonedDate(2026, 10, 1, 0, 30).toISOString()).toBe("2026-11-01T04:30:00.000Z");
    expect(zonedDate(2026, 10, 1, 1, 30).toISOString()).toBe("2026-11-01T05:30:00.000Z"); // first occurrence (EDT)
    expect(zonedDate(2026, 10, 1, 3, 0).toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });

  it("supports other zones explicitly", () => {
    expect(zonedDate(2026, 2, 3, 0, 0, 0, "UTC").toISOString()).toBe("2026-03-03T00:00:00.000Z");
    expect(zonedDate(2026, 2, 3, 9, 0, 0, "Asia/Tokyo").toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });
});

describe("zonedDateFromInput", () => {
  it("combines date and time inputs in the company zone", () => {
    expect(zonedDateFromInput("2026-03-02", "22:30")?.toISOString()).toBe(LATE.toISOString());
    expect(zonedDateFromInput("2026-03-03")?.toISOString()).toBe("2026-03-03T05:00:00.000Z");
  });

  it("returns null for malformed input", () => {
    expect(zonedDateFromInput("03/02/2026", "22:30")).toBeNull();
    expect(zonedDateFromInput("2026-03-02", "9pm")).toBeNull();
  });
});

describe("fromDateOnly", () => {
  it("re-anchors a UTC-midnight date-only value to the same Eastern calendar date", () => {
    const stored = new Date("1990-03-03"); // how birthdays are persisted
    expect(dateKey(stored)).toBe("1990-03-02"); // the bug: UTC midnight reads as the prior evening
    expect(dateKey(fromDateOnly(stored))).toBe("1990-03-03");
    expect(fromDateOnly(stored).toISOString()).toBe("1990-03-03T05:00:00.000Z");
  });
});

describe("day boundaries", () => {
  it("detects Eastern midnight and 23:59", () => {
    expect(isStartOfDay(zonedDate(2026, 7, 5))).toBe(true);
    expect(isEndOfDay(zonedDate(2026, 7, 5, 23, 59, 59))).toBe(true);
    expect(isStartOfDay(new Date("2026-08-05T00:00:00Z"))).toBe(false); // 8 PM Eastern
    expect(isEndOfDay(new Date("2026-08-05T23:59:59Z"))).toBe(false); // 7:59 PM Eastern
    expect(isStartOfDay(EST)).toBe(false);
  });
});

describe("daysBetween", () => {
  it("counts Eastern calendar days regardless of time of day", () => {
    expect(daysBetween(EST, EST)).toBe(0);
    expect(daysBetween(zonedDate(2026, 2, 2, 23, 0), zonedDate(2026, 2, 3, 1, 0))).toBe(1);
    expect(daysBetween(new Date("2026-03-03T02:00:00Z"), new Date("2026-03-03T06:00:00Z"))).toBe(1);
    expect(daysBetween(zonedDate(2026, 2, 10), zonedDate(2026, 2, 3))).toBe(-7);
    // A DST week is still seven days.
    expect(daysBetween(zonedDate(2026, 2, 7), zonedDate(2026, 2, 14))).toBe(7);
  });
});
