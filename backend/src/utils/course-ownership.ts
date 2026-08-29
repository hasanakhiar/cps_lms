import type { PolicyContext } from '../types/api-context';

/**
 * Shared ownership check for content that hangs off a course — lessons and quizzes.
 *
 * `can-manage-lesson` and `can-manage-quiz` were separate files with the same forty
 * lines in each, differing only in the content type they resolved. Two copies of an
 * authorisation rule is two rules as soon as one is patched, and the patch below —
 * the course-reassignment hole — is exactly the kind that would have been applied to
 * one and not the other.
 */

/** Content types whose ownership derives from their parent course. */
type CourseChildUid = 'api::lesson.lesson' | 'api::quiz.quiz';

/**
 * Read the `course` a write is declaring, if any.
 *
 * This is the one place a policy in this codebase reads the request body, and it is
 * legitimate: for a create, the body is the only thing that says which course the new
 * lesson belongs to. The pattern is *trust the body to say what is being written,
 * verify against the database whether it is allowed* — never *trust the body to say
 * who the writer is*.
 *
 * Only a plain documentId string is accepted. Strapi 5 also accepts relation input as
 * `{ connect: [...] }`, `{ set: [...] }` and `{ disconnect: [...] }`, and a policy that
 * tried to interpret all of those would be reimplementing Strapi's relation parser in
 * order to authorise against it — where any disagreement between the two
 * implementations is a bypass. Rejecting the shapes it cannot verify is the safe half
 * of that trade: the frontend sends a documentId string, and anything else is denied
 * rather than guessed at.
 */
const readDeclaredCourse = (policyContext: PolicyContext): string | null => {
  const course = policyContext.request.body?.data?.course;
  return typeof course === 'string' && course.length > 0 ? course : null;
};

/**
 * Does `userId` own the course identified by `courseDocumentId`?
 */
const ownsCourse = async (courseDocumentId: string, userId: number): Promise<boolean> => {
  const course = await strapi.documents('api::course.course').findOne({
    documentId: courseDocumentId,
    // The decision turns on one integer, so only that integer is loaded.
    fields: ['title'],
    populate: { instructor: { fields: ['id'] } },
  });

  if (!course?.instructor) return false;

  return course.instructor.id === userId;
};

/**
 * May the caller create, edit or delete this piece of course content?
 *
 * Three cases, in order:
 *
 *  - admin / content-manager: yes, they manage the whole catalogue.
 *  - instructor: only within courses they own — checked against the database.
 *  - anything else: no.
 *
 * The instructor case has two halves, and the second one is easy to miss. On a create,
 * the only course involved is the one the body names. On an update, there are
 * potentially *two*: the course the item currently belongs to, and the course the body
 * is trying to move it to. Checking only the current one leaves a hole — an instructor
 * could take a lesson they legitimately own and reassign it into another instructor's
 * course, injecting content into a course they have no rights over. So a reassignment
 * requires ownership of both ends.
 */
export const canManageCourseChild = async (
  policyContext: PolicyContext,
  uid: CourseChildUid
): Promise<boolean> => {
  const user = policyContext.state.user;
  if (!user) return false;

  const role = user.role?.type;
  if (!role) return false;

  if (role === 'admin' || role === 'content-manager') {
    return true;
  }

  // Fail closed for every other role, including any added to the platform later
  // without a decision being made here.
  if (role !== 'instructor') {
    return false;
  }

  const declaredCourse = readDeclaredCourse(policyContext);

  // Create: the body names the target course and that is the only course in play.
  if (policyContext.request.method === 'POST') {
    if (!declaredCourse) return false;
    return ownsCourse(declaredCourse, user.id);
  }

  // Update and delete address an existing item by documentId.
  const documentId = policyContext.params.id;
  if (!documentId) return false;

  const item = await strapi.documents(uid).findOne({
    documentId,
    fields: ['title'],
    populate: { course: { fields: ['documentId'] } },
  });

  // An orphaned item has no course to derive ownership from, so no instructor owns it
  // and only the two manager roles — already returned above — can touch it.
  const currentCourse = item?.course?.documentId;
  if (!currentCourse) return false;

  if (!(await ownsCourse(currentCourse, user.id))) {
    return false;
  }

  // The reassignment case. `declaredCourse === currentCourse` is a no-op write and
  // needs no second check.
  if (declaredCourse && declaredCourse !== currentCourse) {
    return ownsCourse(declaredCourse, user.id);
  }

  return true;
};

/**
 * The documentIds of every course `userId` teaches.
 *
 * Exists because the obvious ownership filter does not survive the content API.
 * `filters: { course: { instructor: { id } } }` reads correctly and is what both
 * `lesson.find` and `quiz.find` originally used, but Strapi's query validator refuses
 * to traverse into `instructor`: that relation targets
 * `plugin::users-permissions.user`, and the validator rejects a filter path through a
 * content type the caller has no read permission on. The request fails with a 400
 * `Invalid key instructor at course.instructor` rather than returning unscoped rows,
 * so it fails safe — but it fails.
 *
 * The alternative would be granting instructors `users-permissions.user.find`, which
 * trades a working filter for an exposed user list. Resolving the ids here instead
 * costs one extra query and keeps the user relation out of any caller-visible query.
 *
 * An instructor who owns no courses yields `[]`, and `{ $in: [] }` matches nothing —
 * which is the correct answer, not an empty filter that would match everything.
 */
export const ownedCourseDocumentIds = async (userId: number): Promise<string[]> => {
  const courses = await strapi.db.query('api::course.course').findMany({
    where: { instructor: { id: userId } },
    select: ['documentId'],
  });

  return courses.map((course: { documentId: string }) => course.documentId);
};
