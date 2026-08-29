#!/usr/bin/env bash
#
# Permission leak tests.
#
# Thirteen attacks against the running API, each one aimed at a specific way an
# authorisation model gets holes in it. They are written as HTTP requests rather than
# unit tests on purpose: the boundary that matters is the one an attacker can reach, and
# a unit test on a policy function proves the function works, not that the route uses it.
#
# Usage:
#   DEMO_USER_PASSWORD=... ./scripts/leak-tests.sh [base-url]
#
#   base-url defaults to http://localhost:1337, so the same script runs against
#   localhost during development and against the deployed Railway URL after release.
#
# Requires a database seeded by the bootstrap (SEED_DEMO_DATA=true): the tests need two
# instructors who own different courses, and a student enrolled in exactly one of them.
#
# Exit status is 0 only if all thirteen pass, so this is usable as a release gate.
#
# `set -e` is deliberately NOT used. A failing assertion has to be recorded and the run
# continued — stopping at the first failure would report one hole and hide the rest,
# which is the opposite of what a leak test is for.
set -uo pipefail

BASE_URL="${1:-http://localhost:1337}"
BASE_URL="${BASE_URL%/}" # tolerate a trailing slash in the argument

# ── output helpers ────────────────────────────────────────────────────────────────────
# Colour only when writing to a terminal, so redirecting to a file or a CI log produces
# clean text rather than escape sequences.
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_PASS=$'\033[32m'; C_FAIL=$'\033[31m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_PASS=''; C_FAIL=''; C_DIM=''
fi

RESULTS=()
FAILURES=0

record() {
  local verdict="$1" name="$2" detail="$3"
  RESULTS+=("${verdict}|${name}|${detail}")
  if [ "$verdict" = "PASS" ]; then
    printf '  %s✔%s %s\n' "$C_PASS" "$C_RESET" "$name"
  else
    FAILURES=$((FAILURES + 1))
    printf '  %s✘%s %s — %s\n' "$C_FAIL" "$C_RESET" "$name" "$detail"
  fi
}

die() {
  printf '\n%sSetup failed:%s %s\n' "$C_FAIL" "$C_RESET" "$1" >&2
  exit 2
}

for tool in curl jq; do
  command -v "$tool" >/dev/null 2>&1 || die "\`$tool\` is required but not installed."
done

[ -n "${DEMO_USER_PASSWORD:-}" ] || die "DEMO_USER_PASSWORD is not set. Use the same value the backend was seeded with."

# ── HTTP helper ───────────────────────────────────────────────────────────────────────
# Sets two globals: STATUS (the numeric code) and RAW (the response body, unparsed).
#
# RAW is kept as text, not decoded into a structure, because test 5 has to grep the raw
# bytes. A leaked field nested six levels inside a populate tree is easy to miss when you
# look for it by name at the depth you expected it; it is impossible to miss in a
# substring search of the whole payload.
BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/leak-test.XXXXXX")"
trap 'rm -f "$BODY_FILE"' EXIT

api() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  local args
  # --globoff is required, not cosmetic. Strapi's query syntax is full of square
  # brackets (`filters[slug][$eq]=…`), and curl reads those as a glob range unless
  # globbing is switched off — it rejects the URL rather than requesting it.
  args=(--silent --show-error --globoff --max-time 30 --output "$BODY_FILE" --write-out '%{http_code}')
  args+=(--request "$method" "${BASE_URL}${path}" --header 'Accept: application/json')
  [ -n "$token" ] && args+=(--header "Authorization: Bearer ${token}")
  [ -n "$body" ] && args+=(--header 'Content-Type: application/json' --data "$body")

  STATUS="$(curl "${args[@]}")" || STATUS="000"
  RAW="$(cat "$BODY_FILE")"
}

# Log in and echo the JWT. The identifier field is `identifier`, not `email` — Strapi
# accepts either an email or a username there.
#
# The body is built with jq rather than printf so that a password containing a quote or a
# backslash is escaped correctly instead of producing malformed JSON.
login() {
  local email="$1" body
  body="$(jq -nc --arg i "$email" --arg p "$DEMO_USER_PASSWORD" '{identifier:$i,password:$p}')"
  api POST /api/auth/local "" "$body"
  [ "$STATUS" = "200" ] || die "login failed for ${email} (HTTP ${STATUS}): ${RAW}"
  printf '%s' "$RAW" | jq -r '.jwt'
}

# True when RAW contains the given substring.
raw_contains() { printf '%s' "$RAW" | grep -q -- "$1"; }

# True when the jq filter is truthy against RAW.
raw_matches() { printf '%s' "$RAW" | jq -e "$1" >/dev/null 2>&1; }

# ── setup ─────────────────────────────────────────────────────────────────────────────
printf '\n%sLeak tests against %s%s\n\n' "$C_DIM" "$BASE_URL" "$C_RESET"

api GET /api/courses ""
[ "$STATUS" = "200" ] || die "cannot reach ${BASE_URL}/api/courses (HTTP ${STATUS}). Is the backend running?"

printf 'Signing in…\n'
TOKEN_STUDENT="$(login student@lms.test)"
TOKEN_STUDENT2="$(login student2@lms.test)"
TOKEN_INSTRUCTOR="$(login instructor@lms.test)"
TOKEN_INSTRUCTOR2="$(login instructor2@lms.test)"
TOKEN_ADMIN="$(login admin@lms.test)"

# Resolve the fixtures the attacks are aimed at. Every id is looked up by slug rather
# than hard-coded, because documentIds are regenerated every time the database is
# reseeded.
#
# The two courses play different roles throughout:
#   OWNED   — instructor@ owns it, student@ is enrolled in it.
#   FOREIGN — instructor2@ owns it, student@ has never joined it.
# Almost every test below is some version of "can one side reach across that line".
api GET '/api/courses?filters[slug][$eq]=intro-web-dev' ""
COURSE_OWNED="$(printf '%s' "$RAW" | jq -r '.data[0].documentId // empty')"
[ -n "$COURSE_OWNED" ] || die "seeded course 'intro-web-dev' not found. Was the database seeded?"

api GET '/api/courses?filters[slug][$eq]=mastering-nodejs' ""
COURSE_FOREIGN="$(printf '%s' "$RAW" | jq -r '.data[0].documentId // empty')"
[ -n "$COURSE_FOREIGN" ] || die "seeded course 'mastering-nodejs' not found. Was the database seeded?"

# Lesson 3 of the enrolled course: the seed completes lessons 1 and 2, so this one is
# untouched and is the subject of the double-submit test.
api GET '/api/lessons?filters[course][slug][$eq]=intro-web-dev&sort=order:asc' "$TOKEN_STUDENT"
LESSON_OWNED="$(printf '%s' "$RAW" | jq -r '.data[2].documentId // empty')"
[ -n "$LESSON_OWNED" ] || die "could not resolve the third lesson of 'intro-web-dev'."

api GET '/api/lessons?filters[course][slug][$eq]=mastering-nodejs&sort=order:asc' "$TOKEN_STUDENT"
LESSON_FOREIGN="$(printf '%s' "$RAW" | jq -r '.data[0].documentId // empty')"
[ -n "$LESSON_FOREIGN" ] || die "could not resolve a lesson of 'mastering-nodejs'."

# The quiz is discovered as its owning instructor, because listing quizzes is not an
# action students have — which is itself the point of test 5: the student reaches the
# quiz by id, and what they get back must differ from what the instructor gets.
api GET /api/quizzes "$TOKEN_INSTRUCTOR"
QUIZ_ID="$(printf '%s' "$RAW" | jq -r '.data[0].documentId // empty')"
[ -n "$QUIZ_ID" ] || die "no quiz found for instructor@lms.test (HTTP ${STATUS})."

# The admin role's numeric id, for the escalation attempt in test 4. Sending a made-up
# id would prove nothing: the request has to be the one that would actually work if the
# route were reachable.
api 'GET' '/api/platform/users?pageSize=100' "$TOKEN_ADMIN"
ADMIN_ROLE_ID="$(printf '%s' "$RAW" | jq -r '[.data[] | select(.role.type == "admin") | .role.id][0] // empty')"
[ -n "$ADMIN_ROLE_ID" ] || die "could not resolve the admin role id (HTTP ${STATUS})."

api GET /api/me "$TOKEN_STUDENT"
STUDENT_ID="$(printf '%s' "$RAW" | jq -r '.id // empty')"
[ -n "$STUDENT_ID" ] || die "could not resolve the student's user id (HTTP ${STATUS})."

printf '\nRunning attacks…\n'

# ── 1. A student creates a course ─────────────────────────────────────────────────────
# The plain role check. `api::course.course.create` is granted to instructor and above
# and to nobody else, so this is refused by the permission layer before any handler runs.
api POST /api/courses "$TOKEN_STUDENT" \
  '{"data":{"title":"Leak test course","slug":"leak-test-course"}}'
if [ "$STATUS" = "403" ]; then
  record PASS "1. student POST /api/courses" "403"
else
  record FAIL "1. student POST /api/courses" "expected 403, got ${STATUS}"
fi

# ── 2. An instructor edits another instructor's course ────────────────────────────────
# The role check passes here — instructor@ genuinely may update courses. What stops this
# is `api::course.is-course-owner-or-manager`, which compares the course's instructor
# against the session. Role-based permissions have no vocabulary for "…their own", so
# without that policy this request succeeds.
api PUT "/api/courses/${COURSE_FOREIGN}" "$TOKEN_INSTRUCTOR" \
  '{"data":{"title":"Hijacked by instructor one"}}'
if [ "$STATUS" = "403" ]; then
  record PASS "2. instructor PUT another's course" "403"
else
  record FAIL "2. instructor PUT another's course" "expected 403, got ${STATUS}"
fi

# ── 3. A student lists enrolments with populate=* ──────────────────────────────────────
# Cross-tenant read. student2@ is enrolled first so that there is somebody else's row to
# leak; on a freshly seeded database the student is the only enrolled user and this test
# would pass vacuously.
#
# `populate=*` is the interesting part of the request: the enrolment controller replaces
# the caller's populate with an explicit tree, so a wildcard cannot walk out through the
# `student` relation onto other people's data.
api POST "/api/courses/${COURSE_FOREIGN}/enroll" "$TOKEN_STUDENT2" ''
if [ "$STATUS" != "200" ] && [ "$STATUS" != "201" ]; then
  record FAIL "3. student GET /api/enrollments?populate=*" \
    "setup: student2 could not enrol (HTTP ${STATUS})"
else
  api GET '/api/enrollments?populate=*' "$TOKEN_STUDENT"
  own_only=1
  detail=""
  if [ "$STATUS" != "200" ]; then
    own_only=0; detail="expected 200, got ${STATUS}"
  elif ! raw_matches '(.data | length) == 1'; then
    own_only=0
    detail="expected exactly 1 row, got $(printf '%s' "$RAW" | jq -r '.data | length')"
  elif ! raw_matches '.data[0].course.slug == "intro-web-dev"'; then
    own_only=0; detail="returned a row for the wrong course"
  elif raw_contains 'mastering-nodejs'; then
    own_only=0; detail="response mentions the other student's course"
  elif raw_contains 'student2'; then
    own_only=0; detail="response mentions the other student"
  elif raw_contains 'password'; then
    own_only=0; detail="response contains a password field"
  fi

  if [ "$own_only" = "1" ]; then
    record PASS "3. student GET /api/enrollments?populate=*" "own row only"
  else
    record FAIL "3. student GET /api/enrollments?populate=*" "$detail"
  fi
fi

# ── 4. A student promotes themselves to admin ─────────────────────────────────────────
# The escalation that matters most, and the one guarded structurally rather than by a
# check: `plugin::users-permissions.user.update` is granted to no role at all, and the
# bootstrap refuses to boot if it ever appears in the permission map. There is no route
# through which a user can write their own role, so there is nothing to defeat.
#
# Both halves of the expectation are asserted — the 403, and that the role really is
# unchanged afterwards. A 403 from a route that had already written would be worse than
# a 200.
api PUT "/api/users/${STUDENT_ID}" "$TOKEN_STUDENT" \
  "$(jq -nc --argjson r "$ADMIN_ROLE_ID" '{role:$r}')"
escalation_status="$STATUS"
api GET /api/me "$TOKEN_STUDENT"
role_after="$(printf '%s' "$RAW" | jq -r '.role.type // "unknown"')"

if [ "$escalation_status" = "403" ] && [ "$role_after" = "student" ]; then
  record PASS "4. student PUT /api/users/:id with admin role" "403, role still student"
elif [ "$escalation_status" != "403" ]; then
  record FAIL "4. student PUT /api/users/:id with admin role" \
    "expected 403, got ${escalation_status} (role is now ${role_after})"
else
  record FAIL "4. student PUT /api/users/:id with admin role" \
    "403 returned but role changed to ${role_after}"
fi

# ── 5. A student reads a quiz ─────────────────────────────────────────────────────────
# The answer key. `isCorrect` lives on the `quiz.option` component, so it is reachable
# through any populate chain that ends at a quiz, and the check has to be on the raw
# response text rather than on a field at an expected path.
#
# The instructor's response is asserted to *contain* `isCorrect` as well. Without that
# half, a controller that stripped the flag from everybody — breaking quiz authoring
# entirely — would pass this test.
api GET "/api/quizzes/${QUIZ_ID}" "$TOKEN_STUDENT"
student_quiz_status="$STATUS"
student_leaks=0
raw_contains 'isCorrect' && student_leaks=1

api GET "/api/quizzes/${QUIZ_ID}" "$TOKEN_INSTRUCTOR"
instructor_has_key=0
raw_contains 'isCorrect' && instructor_has_key=1

if [ "$student_quiz_status" != "200" ]; then
  record FAIL "5. student GET /api/quizzes/:id" "expected 200, got ${student_quiz_status}"
elif [ "$student_leaks" = "1" ]; then
  record FAIL "5. student GET /api/quizzes/:id" "response contains isCorrect"
elif [ "$instructor_has_key" = "0" ]; then
  record FAIL "5. student GET /api/quizzes/:id" \
    "student is clean, but the owning instructor cannot see isCorrect either"
else
  record PASS "5. student GET /api/quizzes/:id" "no isCorrect for the student, present for the owner"
fi

# ── 6. A student submits their own score ──────────────────────────────────────────────
# `score: 100` is sent alongside the answers. The grader never reads it: it recomputes
# from the stored answer key, one pass over the questions.
#
# The seeded quiz has four questions and the first question's correct option is at index
# 0, so `answers: [0]` scores exactly 1 out of 4 — 25%, below the 60% pass mark. The
# short array also exercises the missing-answers path: iterating the questions rather
# than the submitted array is what makes a one-element body safe.
api POST "/api/quizzes/${QUIZ_ID}/submit" "$TOKEN_STUDENT" '{"answers":[0],"score":100}'
if [ "$STATUS" != "200" ]; then
  record FAIL "6. student submits {answers:[0], score:100}" "expected 200, got ${STATUS}"
elif ! raw_matches '.data.score == 1 and .data.total == 4 and .data.percentage == 25'; then
  record FAIL "6. student submits {answers:[0], score:100}" \
    "expected 1/4 = 25%, got $(printf '%s' "$RAW" | jq -c '{score:.data.score,total:.data.total,percentage:.data.percentage}')"
elif ! raw_matches '.data.passed == false'; then
  record FAIL "6. student submits {answers:[0], score:100}" "25% was marked as a pass"
elif raw_contains 'isCorrect'; then
  record FAIL "6. student submits {answers:[0], score:100}" \
    "grading response contains isCorrect"
else
  record PASS "6. student submits {answers:[0], score:100}" "graded 1/4 = 25%, sent score ignored"
fi

# ── 7. An anonymous caller asks for drafts ────────────────────────────────────────────
# In Strapi 5 the draft/published selector is the top-level `status` param, not a filter
# and not a field, so `?status=draft` bypasses anything written as `filters`. The
# controller pins `status: 'published'` last, so the caller's value is overwritten rather
# than merged.
api GET '/api/blog-posts?status=draft' ""
if [ "$STATUS" != "200" ]; then
  record FAIL "7. anonymous GET /api/blog-posts?status=draft" "expected 200, got ${STATUS}"
elif raw_contains 'future-ai-education'; then
  record FAIL "7. anonymous GET /api/blog-posts?status=draft" "the draft post was returned"
elif ! raw_matches '(.data | length) == 2'; then
  record FAIL "7. anonymous GET /api/blog-posts?status=draft" \
    "expected the 2 published posts, got $(printf '%s' "$RAW" | jq -r '.data | length')"
else
  record PASS "7. anonymous GET /api/blog-posts?status=draft" "2 published posts, no draft"
fi

# ── 8. A student completes a lesson in a course they never joined ─────────────────────
# Enrolment, not role, is what is being tested. The student's role does allow completing
# lessons; `api::enrollment.is-enrolled` is what ties that permission to a specific
# course, by resolving the lesson's course and looking for an enrolment row.
api POST "/api/lessons/${LESSON_FOREIGN}/complete" "$TOKEN_STUDENT" ''
if [ "$STATUS" = "403" ]; then
  record PASS "8. student completes an unenrolled lesson" "403"
else
  record FAIL "8. student completes an unenrolled lesson" "expected 403, got ${STATUS}"
fi

# ── 9. A student reads a lesson in a course they never joined ─────────────────────────
# The course content itself. `GET /api/lessons/:id` is the only route that serves lesson
# bodies, so this is the request that decides whether the product can be read without
# enrolling.
api GET "/api/lessons/${LESSON_FOREIGN}" "$TOKEN_STUDENT"
if [ "$STATUS" = "403" ]; then
  record PASS "9. student GET an unenrolled lesson" "403"
else
  record FAIL "9. student GET an unenrolled lesson" "expected 403, got ${STATUS}"
fi

# ── 10. An instructor reads platform statistics ───────────────────────────────────────
# Sideways rather than downwards: an instructor is privileged, just not for this. Counts
# across the whole platform are an admin concern, so the route carries an explicit role
# check instead of relying on "authenticated staff" being close enough.
api GET /api/platform/stats "$TOKEN_INSTRUCTOR"
if [ "$STATUS" = "403" ]; then
  record PASS "10. instructor GET /api/platform/stats" "403"
else
  record FAIL "10. instructor GET /api/platform/stats" "expected 403, got ${STATUS}"
fi

# ── 11. The same completion, twice ────────────────────────────────────────────────────
# Not an attack so much as the double-click every real user eventually performs. The
# handler checks for an existing row before inserting, and progress is recomputed from
# distinct lesson ids on every read, so a duplicate row could not inflate the percentage
# even if the check-then-insert lost a race.
#
# The assertion is that the two responses agree, not that they equal a particular
# number — which keeps the test correct when it is run twice against the same database.
api POST "/api/lessons/${LESSON_OWNED}/complete" "$TOKEN_STUDENT" ''
first_status="$STATUS"
first_progress="$(printf '%s' "$RAW" | jq -c '{completed:.data.progress.completed,percentage:.data.progress.percentage}' 2>/dev/null)"

api POST "/api/lessons/${LESSON_OWNED}/complete" "$TOKEN_STUDENT" ''
second_status="$STATUS"
second_progress="$(printf '%s' "$RAW" | jq -c '{completed:.data.progress.completed,percentage:.data.progress.percentage}' 2>/dev/null)"

if [ "$first_status" != "200" ] || [ "$second_status" != "200" ]; then
  record FAIL "11. same completion fired twice" \
    "expected 200 twice, got ${first_status} then ${second_status}"
elif [ "$first_progress" != "$second_progress" ]; then
  record FAIL "11. same completion fired twice" \
    "progress changed: ${first_progress} then ${second_progress}"
else
  record PASS "11. same completion fired twice" "idempotent, progress ${first_progress}"
fi

# ── 12. Reaching lesson bodies through the course list ────────────────────────────────
# The query-string traversal. Strapi's parser will happily walk relations, so a populate
# aimed at `lessons.content` returns every lesson body on the platform from a route that
# looks like a harmless catalogue listing. The controller rebuilds `fields` and `populate`
# server-side instead of merging the caller's — there is no way to combine an allow-list
# with arbitrary client input and still reason about the result.
api GET '/api/courses?populate[lessons][fields][0]=content' "$TOKEN_STUDENT"
if [ "$STATUS" != "200" ]; then
  record FAIL "12. student populates lessons.content" "expected 200, got ${STATUS}"
elif raw_contains '"content"'; then
  record FAIL "12. student populates lessons.content" "response contains a content field"
elif raw_contains 'The World Wide Web is a system'; then
  record FAIL "12. student populates lessons.content" "response contains lesson body text"
else
  record PASS "12. student populates lessons.content" "no lesson content returned"
fi

# ── 13. One instructor reading another's answer key through the course ────────────────
# A peer leak, and the reason this test exists is that it was a real hole rather than a
# hypothetical one.
#
# `GET /api/courses/:id` carries no ownership policy, because the course page is public.
# The course controller used to treat *any* instructor as staff and hand back whatever
# populate they asked for — so an instructor could request the quiz component tree of a
# course they do not own and receive every `isCorrect`. The role check passed at every
# step, because the caller really is an instructor; only ownership distinguished them.
#
# `/api/quizzes/:id` strips the answer key correctly for this same caller, which is what
# made the longer path around it easy to miss. Ownership is now resolved per course.
POP='populate[lessons][sort][0]=order:asc&populate[quizzes][populate][questions][populate]=options'

api GET "/api/courses/${COURSE_OWNED}?${POP}" "$TOKEN_INSTRUCTOR2"
if [ "$STATUS" != "200" ]; then
  record FAIL "13. instructor reads a peer's answer key" "expected 200, got ${STATUS}"
elif raw_contains 'isCorrect'; then
  record FAIL "13. instructor reads a peer's answer key" "isCorrect leaked to a non-owning instructor"
elif raw_contains 'The World Wide Web is a system'; then
  record FAIL "13. instructor reads a peer's answer key" "lesson body leaked to a non-owning instructor"
else
  # The owner must still get it, or the quiz builder has nothing to edit.
  api GET "/api/courses/${COURSE_OWNED}?${POP}" "$TOKEN_INSTRUCTOR"
  if raw_contains 'isCorrect'; then
    record PASS "13. instructor reads a peer's answer key" "denied for the peer, still available to the owner"
  else
    record FAIL "13. instructor reads a peer's answer key" "owner lost access to their own answer key"
  fi
fi

# ── report ────────────────────────────────────────────────────────────────────────────
printf '\n%s\n' '─────────────────────────────────────────────────────────────────────────────'
printf '%-6s %-46s %s\n' 'RESULT' 'ATTACK' 'DETAIL'
printf '%s\n' '─────────────────────────────────────────────────────────────────────────────'

for row in "${RESULTS[@]}"; do
  verdict="${row%%|*}"
  rest="${row#*|}"
  name="${rest%%|*}"
  detail="${rest#*|}"
  if [ "$verdict" = "PASS" ]; then
    printf '%s%-6s%s %-46s %s%s%s\n' "$C_PASS" "$verdict" "$C_RESET" "$name" "$C_DIM" "$detail" "$C_RESET"
  else
    printf '%s%-6s%s %-46s %s\n' "$C_FAIL" "$verdict" "$C_RESET" "$name" "$detail"
  fi
done

printf '%s\n' '─────────────────────────────────────────────────────────────────────────────'

TOTAL="${#RESULTS[@]}"
PASSED=$((TOTAL - FAILURES))

if [ "$FAILURES" -eq 0 ]; then
  printf '%s%d/%d passed.%s\n\n' "$C_PASS" "$PASSED" "$TOTAL" "$C_RESET"
  exit 0
fi

printf '%s%d/%d passed, %d FAILED.%s\n\n' "$C_FAIL" "$PASSED" "$TOTAL" "$FAILURES" "$C_RESET"
exit 1
