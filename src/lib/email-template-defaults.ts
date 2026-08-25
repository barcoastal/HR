export type EmailTemplateType =
  | "WELCOME"
  | "SIGNING_REQUEST"
  | "TASK_ASSIGNMENT"
  | "SIGNING_CONFIRMATION"
  | "ONBOARDING"
  | "INTERVIEW_SCHEDULED"
  | "BACKGROUND_PRE_ADVERSE"
  | "BACKGROUND_ADVERSE";

export const EMAIL_TEMPLATE_DEFAULTS: Record<
  EmailTemplateType,
  { subject: string; body: string; variables: string[]; description: string }
> = {
  WELCOME: {
    description: "Sent when a new user is invited to the platform",
    variables: ["companyName", "logoUrl", "role", "loginUrl"],
    subject: "Welcome to {{companyName}}",
    body: `<p>You've been invited to join <strong>{{companyName}}</strong> as <strong>{{role}}</strong>.</p>
<p>Sign in with your Google account to get started:</p>
<p style="margin:24px 0">
  <a href="{{loginUrl}}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Sign In to {{companyName}}</a>
</p>
<p style="color:#666;font-size:14px">If you have any questions, reach out to your HR administrator.</p>`,
  },
  SIGNING_REQUEST: {
    description: "Sent when an employee needs to sign a document",
    variables: ["companyName", "logoUrl", "firstName", "documentName", "signingUrl"],
    subject: "Please sign: {{documentName}}",
    body: `<p>Hi {{firstName}},</p>
<p>Please review and sign <strong>{{documentName}}</strong> for your onboarding at {{companyName}}.</p>
<p style="margin:24px 0">
  <a href="{{signingUrl}}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">Review & Sign Document</a>
</p>
<p style="color:#666;font-size:14px">This link expires in 30 days.</p>`,
  },
  TASK_ASSIGNMENT: {
    description: "Sent when an onboarding task is assigned to an employee",
    variables: ["companyName", "logoUrl", "assigneeName", "newHireName", "taskTitle", "taskDescription"],
    subject: "Onboarding task assigned: {{taskTitle}}",
    body: `<p>Hi {{assigneeName}},</p>
<p>You've been assigned to help <strong>{{newHireName}}</strong> with:</p>
<p><strong>{{taskTitle}}</strong></p>
<p>{{taskDescription}}</p>`,
  },
  SIGNING_CONFIRMATION: {
    description: "Sent after a document has been successfully signed",
    variables: ["companyName", "logoUrl", "firstName", "documentName"],
    subject: "Document signed: {{documentName}}",
    body: `<p>Hi {{firstName}},</p>
<p>Thanks for signing <strong>{{documentName}}</strong>. A copy has been saved to your file.</p>`,
  },
  ONBOARDING: {
    description: "General onboarding email with optional document attachment",
    variables: ["companyName", "logoUrl", "body", "documentUrl", "documentName"],
    subject: "{{subject}}",
    body: `<div style="white-space:pre-wrap">{{body}}</div>
{{#documentUrl}}<p style="margin-top:16px"><a href="{{documentUrl}}" style="color:#4f46e5;text-decoration:underline">Download: {{documentName}}</a></p>{{/documentUrl}}`,
  },
  INTERVIEW_SCHEDULED: {
    description:
      "Sent to the candidate whenever an interview is scheduled (any type). meetLinkHtml renders the Join button only when a Google Meet link exists; notesHtml renders the notes line only when notes were entered.",
    variables: [
      "companyName",
      "logoUrl",
      "firstName",
      "interviewType",
      "positionTitle",
      "date",
      "time",
      "duration",
      "meetLink",
      "meetLinkHtml",
      "notesHtml",
    ],
    subject: "Interview Scheduled: {{interviewType}} — {{positionTitle}}",
    body: `<p>Hi {{firstName}},</p>
<p>Your <strong>{{interviewType}}</strong> for the <strong>{{positionTitle}}</strong> position at {{companyName}} has been scheduled.</p>
<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">
  <p style="margin:0"><strong>Date:</strong> {{date}}</p>
  <p style="margin:4px 0 0"><strong>Time:</strong> {{time}}</p>
  <p style="margin:4px 0 0"><strong>Duration:</strong> {{duration}} minutes</p>
</div>
{{meetLinkHtml}}
{{notesHtml}}
<p style="margin-top:16px">We look forward to speaking with you!</p>`,
  },
  BACKGROUND_PRE_ADVERSE: {
    description: "Sent before a potential adverse hiring decision based on a background report",
    variables: ["companyName", "logoUrl", "firstName", "positionTitle", "reason", "responseDueDate", "rightsSummaryUrl"],
    subject: "Important notice regarding your background report",
    body: `<p>Dear {{firstName}},</p>
<p>{{companyName}} is reviewing information in your background report that may affect the decision for <strong>{{positionTitle}}</strong>. No final decision has been made.</p>
<p>The information under review relates to {{reason}}. A copy of the report is attached.</p>
<p>Please review the report and contact the consumer reporting agency if any information is inaccurate or incomplete. You may also send relevant context or documentation to our HR team by <strong>{{responseDueDate}}</strong>.</p>
<p><a href="{{rightsSummaryUrl}}" style="color:#3052FF;text-decoration:underline">Read A Summary of Your Rights Under the Fair Credit Reporting Act</a></p>
<p>Sincerely,<br/>The {{companyName}} team</p>`,
  },
  BACKGROUND_ADVERSE: {
    description: "Sent after the pre-adverse response period when the final decision is not to proceed",
    variables: ["companyName", "logoUrl", "firstName", "positionTitle", "reason"],
    subject: "Update on your application to {{companyName}}",
    body: `<p>Dear {{firstName}},</p>
<p>After reviewing your application and the information provided during the pre-adverse action period, {{companyName}} has decided not to move forward with your candidacy for <strong>{{positionTitle}}</strong>. This decision was based, in whole or in part, on {{reason}}.</p>
<p>The consumer reporting agency did not make this decision and cannot explain why the decision was made. You have the right to dispute inaccurate or incomplete information and to obtain another free copy of your report from the agency within the period provided by law.</p>
<p>Sincerely,<br/>The {{companyName}} team</p>`,
  },
};
