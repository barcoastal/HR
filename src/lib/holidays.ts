// Static holidays for Jewish, Muslim, Christian, and American observances
// Muslim and Jewish holidays shift yearly — dates below cover 2025–2027.
// Update periodically or replace with a date-calculation library.

type Holiday = {
  name: string;
  month: number; // 0-indexed (Jan=0)
  day: number;
  category: "jewish" | "muslim" | "christian" | "american";
};

type DatedHoliday = {
  name: string;
  year: number;
  month: number;
  day: number;
  category: "jewish" | "muslim" | "christian" | "american";
};

// ── Fixed-date holidays (same every year) ──────────────────────────────

const FIXED_AMERICAN: Holiday[] = [
  { name: "New Year's Day", month: 0, day: 1, category: "american" },
  { name: "Independence Day", month: 6, day: 4, category: "american" },
  { name: "Veterans Day", month: 10, day: 11, category: "american" },
  { name: "Christmas Day", month: 11, day: 25, category: "christian" },
  { name: "Juneteenth", month: 5, day: 19, category: "american" },
];

const FIXED_CHRISTIAN: Holiday[] = [
  { name: "Epiphany", month: 0, day: 6, category: "christian" },
  { name: "Ash Wednesday", month: 2, day: 5, category: "christian" }, // varies — see dated
  { name: "All Saints' Day", month: 10, day: 1, category: "christian" },
  { name: "Christmas Eve", month: 11, day: 24, category: "christian" },
];

// ── Floating American holidays (computed) ──────────────────────────────

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(year, month, 1).getDay();
  let day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return day;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const last = new Date(year, month + 1, 0);
  const lastDay = last.getDate();
  const lastDow = last.getDay();
  return lastDay - ((lastDow - weekday + 7) % 7);
}

function getFloatingAmerican(year: number): DatedHoliday[] {
  return [
    { name: "Martin Luther King Jr. Day", year, month: 0, day: nthWeekdayOfMonth(year, 0, 1, 3), category: "american" },
    { name: "Presidents' Day", year, month: 1, day: nthWeekdayOfMonth(year, 1, 1, 3), category: "american" },
    { name: "Memorial Day", year, month: 4, day: lastWeekdayOfMonth(year, 4, 1), category: "american" },
    { name: "Labor Day", year, month: 8, day: nthWeekdayOfMonth(year, 8, 1, 1), category: "american" },
    { name: "Columbus Day", year, month: 9, day: nthWeekdayOfMonth(year, 9, 1, 2), category: "american" },
    { name: "Thanksgiving", year, month: 10, day: nthWeekdayOfMonth(year, 10, 4, 4), category: "american" },
  ];
}

// ── Easter calculation (Computus algorithm) ────────────────────────────

function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function getChristianDated(year: number): DatedHoliday[] {
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month, easter.day);

  const offset = (days: number) => {
    const d = new Date(easterDate);
    d.setDate(d.getDate() + days);
    return { month: d.getMonth(), day: d.getDate() };
  };

  const ashWed = offset(-46);
  const palmSun = offset(-7);
  const goodFri = offset(-2);
  const ascension = offset(39);
  const pentecost = offset(49);

  return [
    { name: "Ash Wednesday", year, ...ashWed, category: "christian" },
    { name: "Palm Sunday", year, ...palmSun, category: "christian" },
    { name: "Good Friday", year, ...goodFri, category: "christian" },
    { name: "Easter Sunday", year, month: easter.month, day: easter.day, category: "christian" },
    { name: "Ascension Day", year, ...ascension, category: "christian" },
    { name: "Pentecost", year, ...pentecost, category: "christian" },
  ];
}

// ── Jewish holidays (lunar calendar — pre-computed per year) ───────────

const JEWISH_HOLIDAYS: Record<number, DatedHoliday[]> = {
  2025: [
    { name: "Purim", year: 2025, month: 2, day: 14, category: "jewish" },
    { name: "Passover (Start)", year: 2025, month: 3, day: 13, category: "jewish" },
    { name: "Passover (End)", year: 2025, month: 3, day: 20, category: "jewish" },
    { name: "Yom HaShoah", year: 2025, month: 3, day: 24, category: "jewish" },
    { name: "Yom HaZikaron", year: 2025, month: 4, day: 1, category: "jewish" },
    { name: "Yom HaAtzmaut", year: 2025, month: 4, day: 2, category: "jewish" },
    { name: "Lag BaOmer", year: 2025, month: 4, day: 16, category: "jewish" },
    { name: "Shavuot", year: 2025, month: 5, day: 2, category: "jewish" },
    { name: "Tisha B'Av", year: 2025, month: 7, day: 3, category: "jewish" },
    { name: "Rosh Hashanah", year: 2025, month: 8, day: 23, category: "jewish" },
    { name: "Yom Kippur", year: 2025, month: 9, day: 2, category: "jewish" },
    { name: "Sukkot (Start)", year: 2025, month: 9, day: 7, category: "jewish" },
    { name: "Simchat Torah", year: 2025, month: 9, day: 14, category: "jewish" },
    { name: "Hanukkah (Start)", year: 2025, month: 11, day: 15, category: "jewish" },
    { name: "Hanukkah (End)", year: 2025, month: 11, day: 22, category: "jewish" },
  ],
  2026: [
    { name: "Purim", year: 2026, month: 2, day: 3, category: "jewish" },
    { name: "Passover (Start)", year: 2026, month: 3, day: 2, category: "jewish" },
    { name: "Passover (End)", year: 2026, month: 3, day: 9, category: "jewish" },
    { name: "Yom HaShoah", year: 2026, month: 3, day: 14, category: "jewish" },
    { name: "Yom HaZikaron", year: 2026, month: 3, day: 21, category: "jewish" },
    { name: "Yom HaAtzmaut", year: 2026, month: 3, day: 22, category: "jewish" },
    { name: "Lag BaOmer", year: 2026, month: 4, day: 5, category: "jewish" },
    { name: "Shavuot", year: 2026, month: 4, day: 22, category: "jewish" },
    { name: "Tisha B'Av", year: 2026, month: 6, day: 23, category: "jewish" },
    { name: "Rosh Hashanah", year: 2026, month: 8, day: 12, category: "jewish" },
    { name: "Yom Kippur", year: 2026, month: 8, day: 21, category: "jewish" },
    { name: "Sukkot (Start)", year: 2026, month: 8, day: 26, category: "jewish" },
    { name: "Simchat Torah", year: 2026, month: 9, day: 3, category: "jewish" },
    { name: "Hanukkah (Start)", year: 2026, month: 11, day: 5, category: "jewish" },
    { name: "Hanukkah (End)", year: 2026, month: 11, day: 12, category: "jewish" },
  ],
  2027: [
    { name: "Purim", year: 2027, month: 2, day: 23, category: "jewish" },
    { name: "Passover (Start)", year: 2027, month: 3, day: 22, category: "jewish" },
    { name: "Passover (End)", year: 2027, month: 3, day: 29, category: "jewish" },
    { name: "Yom HaShoah", year: 2027, month: 4, day: 1, category: "jewish" },
    { name: "Yom HaZikaron", year: 2027, month: 4, day: 11, category: "jewish" },
    { name: "Yom HaAtzmaut", year: 2027, month: 4, day: 12, category: "jewish" },
    { name: "Lag BaOmer", year: 2027, month: 4, day: 25, category: "jewish" },
    { name: "Shavuot", year: 2027, month: 5, day: 11, category: "jewish" },
    { name: "Tisha B'Av", year: 2027, month: 6, day: 12, category: "jewish" },
    { name: "Rosh Hashanah", year: 2027, month: 9, day: 2, category: "jewish" },
    { name: "Yom Kippur", year: 2027, month: 9, day: 11, category: "jewish" },
    { name: "Sukkot (Start)", year: 2027, month: 9, day: 16, category: "jewish" },
    { name: "Simchat Torah", year: 2027, month: 9, day: 23, category: "jewish" },
    { name: "Hanukkah (Start)", year: 2027, month: 11, day: 25, category: "jewish" },
    { name: "Hanukkah (End)", year: 2027, month: 11, day: 31, category: "jewish" },
  ],
};

// ── Muslim holidays (lunar calendar — pre-computed per year) ───────────

const MUSLIM_HOLIDAYS: Record<number, DatedHoliday[]> = {
  2025: [
    { name: "Ramadan (Start)", year: 2025, month: 2, day: 1, category: "muslim" },
    { name: "Laylat al-Qadr", year: 2025, month: 2, day: 27, category: "muslim" },
    { name: "Eid al-Fitr", year: 2025, month: 2, day: 31, category: "muslim" },
    { name: "Eid al-Adha", year: 2025, month: 5, day: 7, category: "muslim" },
    { name: "Islamic New Year", year: 2025, month: 5, day: 27, category: "muslim" },
    { name: "Mawlid al-Nabi", year: 2025, month: 8, day: 5, category: "muslim" },
  ],
  2026: [
    { name: "Ramadan (Start)", year: 2026, month: 1, day: 18, category: "muslim" },
    { name: "Laylat al-Qadr", year: 2026, month: 2, day: 15, category: "muslim" },
    { name: "Eid al-Fitr", year: 2026, month: 2, day: 20, category: "muslim" },
    { name: "Eid al-Adha", year: 2026, month: 4, day: 27, category: "muslim" },
    { name: "Islamic New Year", year: 2026, month: 5, day: 17, category: "muslim" },
    { name: "Mawlid al-Nabi", year: 2026, month: 7, day: 25, category: "muslim" },
  ],
  2027: [
    { name: "Ramadan (Start)", year: 2027, month: 1, day: 8, category: "muslim" },
    { name: "Laylat al-Qadr", year: 2027, month: 2, day: 5, category: "muslim" },
    { name: "Eid al-Fitr", year: 2027, month: 2, day: 10, category: "muslim" },
    { name: "Eid al-Adha", year: 2027, month: 4, day: 17, category: "muslim" },
    { name: "Islamic New Year", year: 2027, month: 5, day: 7, category: "muslim" },
    { name: "Mawlid al-Nabi", year: 2027, month: 7, day: 15, category: "muslim" },
  ],
};

// ── Public API ─────────────────────────────────────────────────────────

export type HolidayCategory = "jewish" | "muslim" | "christian" | "american";

export type HolidayEvent = {
  name: string;
  date: Date;
  category: HolidayCategory;
};

export function getHolidaysForYear(year: number): HolidayEvent[] {
  const holidays: HolidayEvent[] = [];

  // Fixed American
  for (const h of FIXED_AMERICAN) {
    holidays.push({ name: h.name, date: new Date(year, h.month, h.day), category: h.category });
  }

  // Fixed Christian (only All Saints' and Christmas Eve — Easter-based are in dated)
  holidays.push({ name: "All Saints' Day", date: new Date(year, 10, 1), category: "christian" });
  holidays.push({ name: "Christmas Eve", date: new Date(year, 11, 24), category: "christian" });
  holidays.push({ name: "Epiphany", date: new Date(year, 0, 6), category: "christian" });

  // Floating American
  for (const h of getFloatingAmerican(year)) {
    holidays.push({ name: h.name, date: new Date(year, h.month, h.day), category: h.category });
  }

  // Easter-based Christian
  for (const h of getChristianDated(year)) {
    holidays.push({ name: h.name, date: new Date(year, h.month, h.day), category: h.category });
  }

  // Jewish (pre-computed)
  const jewish = JEWISH_HOLIDAYS[year] || [];
  for (const h of jewish) {
    holidays.push({ name: h.name, date: new Date(year, h.month, h.day), category: h.category });
  }

  // Muslim (pre-computed)
  const muslim = MUSLIM_HOLIDAYS[year] || [];
  for (const h of muslim) {
    holidays.push({ name: h.name, date: new Date(year, h.month, h.day), category: h.category });
  }

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}
