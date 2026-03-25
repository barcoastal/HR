export const AVAILABLE_PLACEHOLDERS = [
  { key: "{{firstName}}", description: "Candidate first name" },
  { key: "{{lastName}}", description: "Candidate last name" },
  { key: "{{fullName}}", description: "Candidate full name" },
  { key: "{{email}}", description: "Candidate email" },
  { key: "{{phone}}", description: "Candidate phone" },
  { key: "{{hourlyRate}}", description: "Hourly rate" },
  { key: "{{position}}", description: "Position applied to" },
  { key: "{{date}}", description: "Today's date" },
  { key: "{{company}}", description: "Company name" },
];

export function fillPlaceholders(
  content: string,
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    hourlyRate: number | null;
    position: { title: string } | null;
  },
  companyName: string
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return content
    .replace(/\{\{firstName\}\}/g, candidate.firstName)
    .replace(/\{\{lastName\}\}/g, candidate.lastName)
    .replace(/\{\{fullName\}\}/g, `${candidate.firstName} ${candidate.lastName}`)
    .replace(/\{\{email\}\}/g, candidate.email)
    .replace(/\{\{phone\}\}/g, candidate.phone || "N/A")
    .replace(
      /\{\{hourlyRate\}\}/g,
      candidate.hourlyRate ? `$${candidate.hourlyRate.toFixed(2)}/hr` : "N/A"
    )
    .replace(/\{\{position\}\}/g, candidate.position?.title || "N/A")
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{company\}\}/g, companyName);
}
