#!/bin/bash
# Fetch candidates + resumes from Jobing locally, push to Railway
# Usage: ./scripts/push-jobing-to-railway.sh

set -e

API_KEY="a224fab0474242946bd241d0a6c3e103"
COMPANY="coastal-debt-resolve"
BASE="https://pro.jobing.com/api"
RAILWAY_URL="https://hr.coastaldebt-tools.com"

echo "=== Fetching jobs from Jobing ==="
JOBS=$(curl -s "${BASE}/jobs?company=${COMPANY}" \
  -H "Authorization: Bearer token=${API_KEY}" \
  -H "Accept: application/json")

JOB_COUNT=$(echo "$JOBS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])))")
echo "Found ${JOB_COUNT} jobs"

echo "=== Fetching all applicants (bulk) ==="
ALL_APPLICANTS="[]"
PAGE=1
TOTAL=0

while true; do
  RESP=$(curl -s "${BASE}/applicants/bulk?company=${COMPANY}&page=${PAGE}" \
    -H "Authorization: Bearer token=${API_KEY}" \
    -H "Accept: application/json")

  COUNT=$(echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('results', d if isinstance(d, list) else [])
print(len(r))
" 2>/dev/null || echo "0")

  if [ "$COUNT" = "0" ]; then
    break
  fi

  echo "  Page ${PAGE}: ${COUNT} applicants"
  TOTAL=$((TOTAL + COUNT))

  # Merge into ALL_APPLICANTS
  ALL_APPLICANTS=$(echo "$ALL_APPLICANTS" "$RESP" | python3 -c "
import sys, json
existing = json.loads(sys.stdin.readline())
new_data = json.load(sys.stdin)
results = new_data.get('results', new_data if isinstance(new_data, list) else [])
existing.extend(results)
print(json.dumps(existing))
")

  PAGE=$((PAGE + 1))
  if [ $PAGE -gt 100 ]; then break; fi
done

echo "Total applicants from bulk: ${TOTAL}"

echo "=== Fetching per-job applicants ==="
PER_JOB_URLS=$(echo "$JOBS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for j in d.get('results', []):
    url = j.get('applicants', '')
    if url:
        print(url)
")

while IFS= read -r APP_URL; do
  [ -z "$APP_URL" ] && continue
  RESP=$(curl -s "$APP_URL" \
    -H "Authorization: Bearer token=${API_KEY}" \
    -H "Accept: application/json" 2>/dev/null || echo "[]")

  COUNT=$(echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d if isinstance(d, list) else d.get('results', d.get('applicants', []))
print(len(r))
" 2>/dev/null || echo "0")

  if [ "$COUNT" != "0" ]; then
    ALL_APPLICANTS=$(echo "$ALL_APPLICANTS" "$RESP" | python3 -c "
import sys, json
existing = json.loads(sys.stdin.readline())
new_data = json.load(sys.stdin)
results = new_data if isinstance(new_data, list) else new_data.get('results', new_data.get('applicants', []))
seen = {a.get('email','').lower() for a in existing if a.get('email')}
for r in results:
    email = (r.get('email') or '').lower()
    if email and email not in seen:
        existing.append(r)
        seen.add(email)
print(json.dumps(existing))
")
  fi
done <<< "$PER_JOB_URLS"

FINAL_COUNT=$(echo "$ALL_APPLICANTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "Total unique applicants: ${FINAL_COUNT}"

echo "=== Building candidate payload with resumes ==="
# Process applicants: map to candidates and download resumes as base64
PAYLOAD=$(echo "$ALL_APPLICANTS" "$JOBS" | python3 -c "
import sys, json, urllib.request, base64

applicants = json.loads(sys.stdin.readline())
jobs_data = json.load(sys.stdin)
job_map = {}
for j in jobs_data.get('results', []):
    job_map[j.get('id', '')] = j.get('title', '')

candidates = []
seen = set()
downloaded = 0
failed = 0

for a in applicants:
    email = (a.get('email') or '').lower().strip()
    if not email or email in seen:
        continue
    seen.add(email)

    job_title = job_map.get(a.get('job_id', ''), '')
    resume_url = a.get('resume') or a.get('resume_url') or ''

    c = {
        'firstName': a.get('first_name', ''),
        'lastName': a.get('last_name', ''),
        'email': email,
        'phone': a.get('phone'),
        'skills': [],
        'experience': f'Applied for: {job_title}' if job_title else None,
        'notes': f\"Referrer: {a.get('referer')}\" if a.get('referer') else None,
        'source': 'pro.jobing',
        'jobAppliedTo': job_title or None,
        'resumeUrl': resume_url or None,
    }

    # Download resume
    if resume_url:
        try:
            req = urllib.request.Request(resume_url, headers={
                'Authorization': 'Bearer token=${API_KEY}',
                'Accept': 'application/pdf',
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read()
                if len(data) >= 100:
                    c['resumeBase64'] = base64.b64encode(data).decode('ascii')
                    downloaded += 1
                else:
                    failed += 1
        except Exception as e:
            failed += 1
            pass

    candidates.append(c)

print(json.dumps({'candidates': candidates}), flush=True)
print(f'Resumes: {downloaded} downloaded, {failed} failed', file=sys.stderr)
")

CAND_COUNT=$(echo "$PAYLOAD" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['candidates']))")
echo "Prepared ${CAND_COUNT} candidates with resumes"

echo "=== Pushing to Railway ==="
RESULT=$(echo "$PAYLOAD" | curl -s -X POST "${RAILWAY_URL}/api/candidates/resync-jobing" \
  -H "Content-Type: application/json" \
  --data-binary @-)

echo "Result: $RESULT"
echo "=== Done ==="
