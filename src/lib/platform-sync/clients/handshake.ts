import type { PlatformClient, MockCandidate } from "../types";

export class HandshakeClient implements PlatformClient {
  readonly platformName = "Handshake";

  async validateCredentials(apiKey: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 600));
    return apiKey.startsWith("hs-") && apiKey.length > 5;
  }

  async fetchCandidates(): Promise<MockCandidate[]> {
    await new Promise((r) => setTimeout(r, 900));
    return [
      {
        firstName: "Jane",
        lastName: "Kim",
        email: "jane.kim@ufl.edu",
        phone: "+1 (352) 555-0101",
        skills: ["Python", "Data Science", "Pandas", "Machine Learning", "Jupyter"],
        experience: "Intern — Data Science Intern at IBM (Summer 2025)",
        notes: "GPA: 3.8. University of Florida, CS major. Graduating May 2026. Dean's List.",
        source: "Handshake",
      },
      {
        firstName: "Tyler",
        lastName: "Nguyen",
        email: "tyler.nguyen@gatech.edu",
        skills: ["Java", "Spring Boot", "React", "MongoDB", "Git"],
        experience: "Intern — Software Engineering Intern at Microsoft (Summer 2025)",
        notes: "GPA: 3.6. Georgia Tech, Computer Science. Expected graduation Dec 2025. Hackathon winner.",
        source: "Handshake",
      },
      {
        firstName: "Aisha",
        lastName: "Johnson",
        email: "aisha.johnson@fsu.edu",
        phone: "+1 (850) 555-0202",
        skills: ["Marketing", "Social Media", "Canva", "Google Analytics", "Copywriting"],
        experience: "0 years — Marketing Club President, FSU",
        notes: "GPA: 3.5. Florida State University, Marketing major. Graduating May 2026. Campus ambassador for 3 brands.",
        source: "Handshake",
      },
      {
        firstName: "Kevin",
        lastName: "Pham",
        email: "kevin.pham@mit.edu",
        skills: ["C++", "Algorithms", "Embedded Systems", "MATLAB", "Linux"],
        experience: "Intern — Firmware Engineering Intern at Tesla (Summer 2025)",
        notes: "GPA: 3.9. MIT, Electrical Engineering & CS. Graduating June 2026. Published research.",
        source: "Handshake",
      },
      {
        firstName: "Sophie",
        lastName: "Martinez",
        email: "sophie.martinez@ucf.edu",
        phone: "+1 (407) 555-0303",
        skills: ["UI/UX Design", "Figma", "Adobe XD", "HTML/CSS", "User Testing"],
        experience: "Intern — UX Design Intern at Chewy (Fall 2025)",
        notes: "GPA: 3.7. UCF, Digital Media. Graduating May 2026. Won UCF Design Showcase.",
        source: "Handshake",
      },
    ];
  }
}
