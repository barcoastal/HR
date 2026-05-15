import { NextResponse } from "next/server";
import { db } from "@/lib/db";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

const ADVANCE_DAYS = 14; // 2 weeks before anniversary

/**
 * GET /api/cron/anniversary-reviews
 * Called daily by Railway cron or external scheduler.
 * For each active employee whose anniversary is in 14 days:
 *  1. Creates an anniversary review cycle (SELF + MANAGER)
 *  2. Sends email notification to employee, manager, and admins
 *  3. Creates in-app notifications
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + ADVANCE_DAYS);
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  // Find employees with anniversary on the target date.
  // archivedAt: null is already enforced by the Prisma extension in db.ts,
  // but we list it explicitly here in case this query ever gets refactored.
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE", archivedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      anniversaryDate: true,
      startDate: true,
      managerId: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });

  const matched = employees.filter((emp) => {
    if (!emp.anniversaryDate) return false;
    return (
      emp.anniversaryDate.getMonth() === targetMonth &&
      emp.anniversaryDate.getDate() === targetDay
    );
  });

  const results = [];

  for (const emp of matched) {
    // Check if an anniversary cycle already exists for this employee this year
    const currentYear = targetDate.getFullYear();
    const existing = await db.reviewCycle.findFirst({
      where: {
        employeeId: emp.id,
        isAnniversary: true,
        startDate: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31),
        },
      },
    });

    if (existing) {
      results.push({ employee: `${emp.firstName} ${emp.lastName}`, status: "already_exists" });
      continue;
    }

    const years = currentYear - emp.startDate.getFullYear();
    const annivDate = new Date(currentYear, targetMonth, targetDay);
    const cycleEndDate = new Date(annivDate);
    cycleEndDate.setDate(cycleEndDate.getDate() + 30); // 30 days to complete

    // Get department template if it exists
    let selfTemplate = null;
    let managerTemplate = null;
    if (emp.departmentId) {
      const deptTemplate = await db.departmentReviewTemplate.findUnique({
        where: { departmentId: emp.departmentId },
      });
      if (deptTemplate) {
        selfTemplate = deptTemplate.selfTemplate;
        managerTemplate = deptTemplate.managerTemplate;
      }
    }

    // Create the review cycle
    const cycle = await db.reviewCycle.create({
      data: {
        name: `${emp.firstName} ${emp.lastName} — Year ${years} Anniversary Review`,
        startDate: now,
        endDate: cycleEndDate,
        status: "ACTIVE",
        employeeId: emp.id,
        departmentId: emp.departmentId,
        isAnniversary: true,
        ...(selfTemplate ? { selfTemplate } : {}),
        ...(managerTemplate ? { managerTemplate } : {}),
      },
    });

    // Create SELF review
    await db.review.create({
      data: {
        cycleId: cycle.id,
        employeeId: emp.id,
        reviewerId: emp.id,
        type: "SELF",
      },
    });

    // Create MANAGER review if they have a manager
    if (emp.managerId) {
      await db.review.create({
        data: {
          cycleId: cycle.id,
          employeeId: emp.id,
          reviewerId: emp.managerId,
          type: "MANAGER",
        },
      });
    }

    // Create notifications
    // For the employee
    await db.notification.create({
      data: {
        recipientId: emp.id,
        type: "PERFORMANCE_REVIEW",
        message: `Your Year ${years} anniversary review is due. Please complete your self-review.`,
        link: "/reviews",
      },
    });

    // For the manager
    if (emp.managerId) {
      await db.notification.create({
        data: {
          recipientId: emp.managerId,
          type: "PERFORMANCE_REVIEW",
          message: `${emp.firstName} ${emp.lastName}'s Year ${years} anniversary review is open. Please complete the manager review.`,
          link: "/reviews",
        },
      });
    }

    // For admins
    const admins = await db.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "HR"] }, employeeId: { not: null } },
      select: { employeeId: true },
    });
    for (const admin of admins) {
      if (admin.employeeId && admin.employeeId !== emp.id && admin.employeeId !== emp.managerId) {
        await db.notification.create({
          data: {
            recipientId: admin.employeeId,
            type: "PERFORMANCE_REVIEW",
            message: `${emp.firstName} ${emp.lastName}'s Year ${years} anniversary review has been created.`,
            link: "/reviews",
          },
        });
      }
    }

    // Send email notification
    try {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail(
        emp.email,
        `Performance Review: Year ${years} Anniversary`,
        `<p>Hi ${emp.firstName},</p>
        <p>Your <strong>Year ${years} Anniversary</strong> is coming up! A performance review has been opened for you.</p>
        <p>Please complete your self-review in the Reviews section.</p>`
      );

      // Email manager
      if (emp.managerId) {
        const manager = await db.employee.findUnique({
          where: { id: emp.managerId },
          select: { email: true, firstName: true },
        });
        if (manager?.email) {
          await sendEmail(
            manager.email,
            `Performance Review Due: ${emp.firstName} ${emp.lastName} — Year ${years}`,
            `<p>Hi ${manager.firstName},</p>
            <p><strong>${emp.firstName} ${emp.lastName}</strong>'s Year ${years} anniversary review is now open.</p>
            <p>Please complete the manager review in the Reviews section.</p>`
          );
        }
      }
    } catch (err) {
      console.error("[cron] Failed to send review notification email:", err);
    }

    results.push({
      employee: `${emp.firstName} ${emp.lastName}`,
      status: "created",
      cycleId: cycle.id,
      years,
    });
  }

  return NextResponse.json({
    checked: employees.length,
    targetDate: targetDate.toISOString().split("T")[0],
    results,
  });
}
