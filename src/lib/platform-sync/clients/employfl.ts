import type { PlatformClient, MockCandidate } from "../types";

export class EmployFLClient implements PlatformClient {
  readonly platformName = "EmployFL";

  async validateCredentials(apiKey: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 600));
    return apiKey.startsWith("efl-") && apiKey.length > 6;
  }

  async fetchCandidates(): Promise<MockCandidate[]> {
    await new Promise((r) => setTimeout(r, 800));
    return [
      {
        firstName: "Carlos",
        lastName: "Mendez",
        email: "carlos.mendez.dev@gmail.com",
        phone: "+1 (305) 555-0110",
        skills: ["JavaScript", "React", "Node.js", "Spanish (Fluent)", "AWS"],
        experience: "5 years — Software Developer at Magic Leap, Plantation FL",
        notes: "Miami-based. Bilingual English/Spanish. Open to hybrid in South FL.",
        source: "EmployFL",
      },
      {
        firstName: "Keisha",
        lastName: "Brown",
        email: "keisha.brown.admin@outlook.com",
        phone: "+1 (786) 555-0220",
        skills: ["Office Administration", "QuickBooks", "Excel", "Customer Service", "Scheduling"],
        experience: "7 years — Office Manager at Baptist Health, Miami FL",
        notes: "Miami-Dade resident. Looking for growth opportunity. Strong organizational skills.",
        source: "EmployFL",
      },
      {
        firstName: "Daniel",
        lastName: "Fischer",
        email: "daniel.fischer.eng@gmail.com",
        phone: "+1 (954) 555-0330",
        skills: ["Mechanical Engineering", "AutoCAD", "SolidWorks", "Project Management", "Lean"],
        experience: "9 years — Senior Engineer at Motorola Solutions, Fort Lauderdale FL",
        notes: "Broward County. PE licensed. Seeking leadership transition.",
        source: "EmployFL",
      },
      {
        firstName: "Ana",
        lastName: "Reyes",
        email: "ana.reyes.nurse@yahoo.com",
        phone: "+1 (407) 555-0440",
        skills: ["Registered Nursing", "Patient Care", "EMR Systems", "Spanish (Fluent)", "BLS/ACLS"],
        experience: "4 years — RN at Orlando Health, Orlando FL",
        notes: "Orlando area. Bilingual. BSN degree. Interested in corporate health roles.",
        source: "EmployFL",
      },
      {
        firstName: "Michael",
        lastName: "Torres",
        email: "michael.torres.data@gmail.com",
        phone: "+1 (813) 555-0550",
        skills: ["SQL", "Python", "Tableau", "Data Analysis", "ETL Pipelines"],
        experience: "3 years — Data Analyst at Raymond James, Tampa FL",
        notes: "Tampa Bay area. Master's in Analytics from USF. EmployFL career fair contact.",
        source: "EmployFL",
      },
    ];
  }
}
