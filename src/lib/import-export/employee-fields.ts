import type { ColumnMapping, FieldDef, FieldKey } from "./types";

export const EMPLOYEE_STATUS_VALUES = ["PENDING", "ACTIVE", "PRE_ONBOARDING", "TRAINING", "ONBOARDING", "OFFBOARDED"] as const;

export const EMPLOYEE_FIELDS: FieldDef[] = [
  { key: "firstName", label: "First name", group: "Identity", type: "text", required: true, synonyms: ["first name", "firstname", "first", "given name", "given"] },
  { key: "middleName", label: "Middle name", group: "Identity", type: "text", synonyms: ["middle name", "middlename", "middle"] },
  { key: "lastName", label: "Last name", group: "Identity", type: "text", required: true, synonyms: ["last name", "lastname", "last", "surname", "family name"] },
  { key: "preferredName", label: "Preferred name", group: "Identity", type: "text", synonyms: ["preferred name", "preferredname", "nickname", "goes by", "display name"] },
  { key: "pronouns", label: "Pronouns", group: "Identity", type: "text", synonyms: ["pronouns", "pronoun"] },
  { key: "email", label: "Email", group: "Contact", type: "email", synonyms: ["email", "e mail", "email address", "e mail address", "work email", "company email"] },
  { key: "personalEmail", label: "Personal email", group: "Contact", type: "email", synonyms: ["personal email", "home email", "secondary email", "other email", "personal e mail"] },
  { key: "phone", label: "Phone", group: "Contact", type: "phone", synonyms: ["phone", "phone number", "telephone", "mobile", "cell", "cell phone", "mobile phone"] },
  { key: "jobTitle", label: "Job title", group: "Job", type: "text", synonyms: ["job title", "jobtitle", "title", "position", "role", "primary job title", "job"] },
  { key: "department", label: "Department", group: "Job", type: "relation", synonyms: ["department", "dept", "current department"] },
  { key: "team", label: "Team", group: "Job", type: "relation", synonyms: ["team", "team name", "sub team", "subteam"] },
  { key: "manager", label: "Manager", group: "Job", type: "relation", synonyms: ["manager", "reports to", "reportsto", "manager name", "manager email", "direct manager", "supervisor", "reporting to"] },
  { key: "status", label: "Status", group: "Job", type: "enum", enumValues: EMPLOYEE_STATUS_VALUES, synonyms: ["status", "employee status", "employment status"] },
  { key: "location", label: "Location", group: "Job", type: "text", synonyms: ["location", "office", "work location", "site"] },
  { key: "startDate", label: "Start date", group: "Dates", type: "date", synonyms: ["start date", "startdate", "hire date", "hiredate", "date hired", "employee start date", "date of hire", "joined"] },
  { key: "birthday", label: "Birthday", group: "Dates", type: "date", synonyms: ["birthday", "birth date", "birthdate", "date of birth", "dob"] },
  { key: "anniversaryDate", label: "Anniversary date", group: "Dates", type: "date", synonyms: ["anniversary", "anniversary date", "work anniversary"] },
  { key: "benefitsEligibleDate", label: "Benefits eligible date", group: "Dates", type: "date", synonyms: ["benefits eligible date", "benefits eligible", "benefits date", "benefits eligibility"] },
  { key: "address", label: "Address", group: "Address", type: "text", synonyms: ["address", "street", "street address", "address line 1", "address 1"] },
  { key: "city", label: "City", group: "Address", type: "text", synonyms: ["city", "town"] },
  { key: "state", label: "State", group: "Address", type: "text", synonyms: ["state", "province", "region"] },
  { key: "zipCode", label: "ZIP code", group: "Address", type: "text", synonyms: ["zip", "zip code", "zipcode", "postal code", "postcode"] },
  { key: "country", label: "Country", group: "Address", type: "text", synonyms: ["country"] },
  { key: "emergencyContactName", label: "Emergency contact name", group: "Emergency", type: "text", synonyms: ["emergency contact", "emergency contact name", "emergency name", "ice name"] },
  { key: "emergencyContactPhone", label: "Emergency contact phone", group: "Emergency", type: "phone", synonyms: ["emergency contact phone", "emergency phone", "ice phone"] },
  { key: "emergencyContactRelation", label: "Emergency contact relation", group: "Emergency", type: "text", synonyms: ["emergency contact relation", "emergency contact relationship", "emergency relation", "relationship"] },
  { key: "bio", label: "Bio", group: "Personal", type: "text", synonyms: ["bio", "about", "biography"] },
  { key: "hobbies", label: "Hobbies", group: "Personal", type: "text", synonyms: ["hobbies", "interests"] },
  { key: "dietaryRestrictions", label: "Dietary restrictions", group: "Personal", type: "text", synonyms: ["dietary restrictions", "dietary", "diet", "allergies"] },
  { key: "tShirtSize", label: "T-shirt size", group: "Personal", type: "text", synonyms: ["t shirt size", "tshirt size", "shirt size", "t shirt"] },
];

export const FIELD_KEYS: FieldKey[] = EMPLOYEE_FIELDS.map((f) => f.key);

export const FIELD_BY_KEY: Record<FieldKey, FieldDef> = Object.fromEntries(
  EMPLOYEE_FIELDS.map((f) => [f.key, f]),
) as Record<FieldKey, FieldDef>;

export const FIELD_GROUPS: FieldDef["group"][] = ["Identity", "Contact", "Job", "Dates", "Address", "Emergency", "Personal"];

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-./*()]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYM_INDEX: Map<string, FieldKey> = new Map();
for (const f of EMPLOYEE_FIELDS) {
  SYNONYM_INDEX.set(normalizeHeader(f.key), f.key);
  SYNONYM_INDEX.set(normalizeHeader(f.label), f.key);
  for (const s of f.synonyms) SYNONYM_INDEX.set(normalizeHeader(s), f.key);
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const used = new Set<FieldKey>();
  return headers.map((h) => {
    const key = SYNONYM_INDEX.get(normalizeHeader(h));
    if (!key || used.has(key)) return "skip";
    used.add(key);
    return key;
  });
}
