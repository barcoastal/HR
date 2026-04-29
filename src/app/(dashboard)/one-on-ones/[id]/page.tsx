import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getOneOnOne } from "@/lib/actions/one-on-ones";
import { OneOnOneDetail } from "@/components/one-on-ones/one-on-one-detail";

export const dynamic = "force-dynamic";

export default async function OneOnOneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  const role = session.user?.role || "EMPLOYEE";
  const myEmployeeId = session.user?.employeeId;

  const data = await getOneOnOne(id);
  if (!data) notFound();
  const { meeting, history } = data;

  const canEdit =
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "HR" ||
    meeting.managerId === myEmployeeId;

  return (
    <div className="max-w-4xl mx-auto p-8 lg:p-12">
      <OneOnOneDetail
        meeting={{
          id: meeting.id,
          type: meeting.type,
          status: meeting.status,
          scheduledAt: meeting.scheduledAt.toISOString(),
          completedAt: meeting.completedAt?.toISOString() || null,
          notebookMarkdown: meeting.notebookMarkdown,
          meetingLink: meeting.meetingLink,
          employee: {
            id: meeting.employee.id,
            firstName: meeting.employee.firstName,
            lastName: meeting.employee.lastName,
            jobTitle: meeting.employee.jobTitle,
            email: meeting.employee.email,
            profilePhoto: meeting.employee.profilePhoto,
          },
          manager: {
            id: meeting.manager.id,
            firstName: meeting.manager.firstName,
            lastName: meeting.manager.lastName,
            jobTitle: meeting.manager.jobTitle,
            email: meeting.manager.email,
            profilePhoto: meeting.manager.profilePhoto,
          },
        }}
        history={history.map((h) => ({
          id: h.id,
          type: h.type,
          completedAt: h.completedAt?.toISOString() || null,
          scheduledAt: h.scheduledAt.toISOString(),
          notebookMarkdown: h.notebookMarkdown,
          managerName: `${h.manager.firstName} ${h.manager.lastName}`,
        }))}
        canEdit={canEdit}
      />
    </div>
  );
}
