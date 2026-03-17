import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const COMPANY_NAME = process.env.INDEED_COMPANY_NAME || "Coastal Debt Resolve";
const COMPANY_URL = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000";

// GET /api/indeed/jobs — XML job feed for Indeed to crawl
export async function GET() {
  const positions = await db.position.findMany({
    where: { status: "OPEN" },
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });

  const jobsXml = positions
    .map((p) => {
      const desc = [
        p.description || "",
        p.requirements ? `<br/><br/><strong>Requirements:</strong><br/>${p.requirements}` : "",
      ].join("");

      const salary = p.salary ? `    <salary><![CDATA[${p.salary}]]></salary>\n` : "";
      const category = p.department ? `    <category><![CDATA[${p.department.name}]]></category>\n` : "";

      return `  <job>
    <title><![CDATA[${p.title}]]></title>
    <date><![CDATA[${new Date(p.createdAt).toUTCString()}]]></date>
    <referencenumber><![CDATA[${p.id}]]></referencenumber>
    <url><![CDATA[${COMPANY_URL}/careers/${p.id}]]></url>
    <company><![CDATA[${COMPANY_NAME}]]></company>
    <city><![CDATA[${process.env.INDEED_CITY || "Fort Lauderdale"}]]></city>
    <state><![CDATA[${process.env.INDEED_STATE || "FL"}]]></state>
    <country><![CDATA[${process.env.INDEED_COUNTRY || "US"}]]></country>
    <postalcode><![CDATA[${process.env.INDEED_POSTAL || "33301"}]]></postalcode>
    <description><![CDATA[${desc}]]></description>
${salary}${category}    <jobtype><![CDATA[fulltime]]></jobtype>
    <indeed-apply-data>
      <indeed-apply-apiToken>${process.env.INDEED_CLIENT_ID || ""}</indeed-apply-apiToken>
      <indeed-apply-postUrl>${COMPANY_URL}/api/indeed/apply</indeed-apply-postUrl>
      <indeed-apply-jobTitle>${p.title}</indeed-apply-jobTitle>
      <indeed-apply-jobId>${p.id}</indeed-apply-jobId>
      <indeed-apply-jobCompanyName>${COMPANY_NAME}</indeed-apply-jobCompanyName>
    </indeed-apply-data>
  </job>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<source>
  <publisher>${COMPANY_NAME}</publisher>
  <publisherurl>${COMPANY_URL}</publisherurl>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${jobsXml}
</source>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
