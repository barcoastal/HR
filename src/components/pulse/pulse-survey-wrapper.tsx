import { getActivePulseSurvey } from "@/lib/actions/pulse";
import { getSession } from "@/lib/auth-helpers";
import { PulsePopup } from "@/components/pulse/pulse-popup";

export async function PulseSurveyWrapper() {
  const session = await getSession();
  const employeeId = session?.user?.employeeId;
  if (!employeeId) return null;

  const data = await getActivePulseSurvey(employeeId);
  if (!data || data.hasResponded) return null;

  return (
    <PulsePopup
      surveyId={data.survey.id}
      question={data.survey.question}
      employeeId={employeeId}
    />
  );
}
