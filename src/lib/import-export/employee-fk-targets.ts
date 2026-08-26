/**
 * Every foreign key in prisma/schema.prisma that points at Employee. `mergeEmployees` re-points
 * each of these from the duplicate to the primary before deleting the duplicate.
 *
 * `__tests__/employee-fk-targets.test.ts` parses the schema and fails when this list drifts, so a
 * new Employee relation cannot be added without deciding how a merge should treat it.
 */
export type EmployeeFkTarget = {
  /** Prisma model name, e.g. "FeedPost". */
  model: string;
  /** Client delegate, e.g. `db.feedPost` (lower-camel model name — "HRNote" is `hRNote`). */
  delegate: string;
  /** The scalar foreign-key column on that model. */
  field: string;
  /** Whether the column is optional (`String?`). */
  nullable: boolean;
};

const t = (model: string, field: string, nullable = false): EmployeeFkTarget => ({
  model,
  delegate: model.charAt(0).toLowerCase() + model.slice(1),
  field,
  nullable,
});

export const EMPLOYEE_FK_TARGETS: EmployeeFkTarget[] = [
  t("Department", "headId", true),
  t("Employee", "managerId", true),
  t("Employee", "buddyId", true),
  t("User", "employeeId", true),
  t("ChecklistItem", "assigneeId", true),
  t("EmployeeTask", "employeeId"),
  t("EmployeeTask", "assigneeId", true),
  t("EmployeeTask", "completedById", true),
  t("ReviewCycle", "employeeId", true),
  t("Review", "employeeId"),
  t("Review", "reviewerId"),
  t("FeedPost", "authorId"),
  t("FeedPost", "mentionedEmployeeId", true),
  t("FeedPollVote", "employeeId"),
  t("FeedComment", "authorId"),
  t("FeedReaction", "employeeId"),
  t("EmergencyAlert", "sentById"),
  t("Notification", "recipientId"),
  t("NotificationRecipient", "employeeId"),
  t("Document", "employeeId"),
  t("HRNote", "employeeId"),
  t("HRNote", "authorId"),
  t("Candidate", "managerId", true),
  t("Interview", "interviewerId", true),
  t("SigningRequest", "employeeId", true),
  t("SigningRequest", "countersignerId", true),
  t("OutOfOffice", "employeeId"),
  t("TrainingGroup", "createdById"),
  t("TrainingGroupMember", "employeeId"),
  t("TrainingClass", "organizerId"),
  t("TrainingClass", "createdById"),
  t("TimeOffBalance", "employeeId"),
  t("TimeOffRequest", "employeeId"),
  t("TimeOffRequest", "approverId", true),
  t("ClubMember", "employeeId"),
  t("PulseResponse", "employeeId"),
  t("StageDocument", "countersignerId", true),
  t("PositionDocument", "countersignerId", true),
  t("EmailDelivery", "senderEmployeeId", true),
  t("ChatMember", "employeeId"),
  t("Channel", "createdById"),
  t("ChannelMember", "employeeId"),
  t("Message", "authorId"),
  t("DmMember", "employeeId"),
  t("Reaction", "employeeId"),
  t("PinnedMessage", "pinnedById"),
  t("SavedMessage", "employeeId"),
  t("OneOnOne", "employeeId"),
  t("OneOnOne", "managerId"),
];
