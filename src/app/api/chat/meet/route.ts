import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { getCalendarClient, isCalendarConnected } from "@/lib/google-calendar";

export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const connected = await isCalendarConnected();
    if (!connected) {
      return NextResponse.json({ error: "Google Calendar not connected. Sign in via Settings." }, { status: 400 });
    }

    const { title } = await req.json().catch(() => ({ title: "" }));
    const summary = title || "Quick Meeting";

    const calendar = await getCalendarClient();
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary,
        start: { dateTime: now.toISOString() },
        end: { dateTime: endTime.toISOString() },
        conferenceData: {
          createRequest: {
            requestId: `chat-meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const meetLink = event.data.hangoutLink;
    if (!meetLink) {
      return NextResponse.json({ error: "Failed to generate Meet link" }, { status: 500 });
    }

    return NextResponse.json({
      meetLink,
      eventId: event.data.id,
      summary,
    });
  } catch (error) {
    console.error("[Meet] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create meeting" },
      { status: 500 }
    );
  }
}
