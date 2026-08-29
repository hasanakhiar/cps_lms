import { factories } from '@strapi/strapi';
import { scopeFindToOwnStudentRows } from '../../../utils/scope-find';
import { computeCourseProgress } from '../../../utils/course-progress';

export default factories.createCoreController(
  'api::lesson-completion.lesson-completion',
  ({ strapi }) => ({
    /**
     * No role is granted this action in the bootstrap — students read their completion
     * state through `GET /api/courses/:id/progress` instead. The override exists
     * anyway, because "nobody can reach it today" is a statement about the permission
     * table, which lives in the database and is editable from the Strapi admin panel.
     * If someone ticks this box in a year, the route should already be safe rather
     * than newly leaking every student's history.
     */
    async find(ctx) {
      await scopeFindToOwnStudentRows(ctx, 'api::lesson-completion.lesson-completion', {
        lesson: { fields: ['documentId', 'title'] },
        course: { fields: ['documentId', 'title', 'slug'] },
      });
      return super.find(ctx);
    },

    /**
     * POST /api/lessons/:id/complete — student, enrolled in the lesson's course.
     *
     * Idempotent. Completing the same lesson twice returns the existing row and the
     * same percentage rather than inserting a second one — leak test 11. A student who
     * double-clicks "mark complete", or whose request is retried by a flaky
     * connection, must not end up at 120%.
     *
     * Idempotency here is check-then-insert, which is not atomic: two genuinely
     * concurrent requests can both find nothing and both insert. That race is
     * tolerated rather than locked out, because the *consequence* is already handled —
     * `computeCourseProgress` deduplicates by lesson id on every read, so a duplicate
     * row cannot change any number the student sees. The alternative, a unique
     * constraint on (student, lesson), would need a schema-level index Strapi does not
     * express and would turn a harmless duplicate into a 500.
     */
    async complete(ctx) {
      const lessonDocumentId = ctx.params.id;
      const user = ctx.state.user;

      // The course is needed both to record the completion against and to compute
      // progress, so it is populated here rather than fetched twice.
      const lesson = await strapi.documents('api::lesson.lesson').findOne({
        documentId: lessonDocumentId,
        fields: ['title'],
        populate: { course: { fields: ['title'] } },
      });

      // A lesson with no course cannot be scored against a course. Treated as missing
      // rather than crashing on `lesson.course.id` two lines down.
      if (!lesson?.course) {
        return ctx.notFound('Lesson not found');
      }
      const course = lesson.course;

      const existingCompletion = await strapi.db
        .query('api::lesson-completion.lesson-completion')
        .findOne({
          where: {
            // Users are not documents, so the user relation joins on the numeric id.
            student: { id: user.id },
            lesson: { id: lesson.id },
          },
          select: ['id', 'documentId', 'completedAt'],
        });

      if (existingCompletion) {
        return {
          data: {
            completion: existingCompletion,
            progress: await computeCourseProgress(user.id, course.id, course.documentId),
          },
        };
      }

      const newCompletion = await strapi
        .documents('api::lesson-completion.lesson-completion')
        .create({
          data: {
            completedAt: new Date(),
            // Numeric id for the user relation, documentIds for the two document
            // relations.
            student: user.id,
            lesson: lesson.documentId,
            course: course.documentId,
          },
          fields: ['completedAt'],
        });

      // Progress is returned with the write so the client does not have to follow up
      // with a second request to refresh the bar it just moved.
      return {
        data: {
          completion: newCompletion,
          progress: await computeCourseProgress(user.id, course.id, course.documentId),
        },
      };
    },

    /**
     * DELETE /api/lessons/:id/complete — student, enrolled in the lesson's course.
     *
     * Also idempotent: un-completing a lesson that was never completed is success, not
     * 404. The caller asked for a state ("this lesson is not complete") and that state
     * holds when the handler returns, which is the only thing they can act on. A 404
     * would say "the lesson does not exist", which is a different and misleading claim.
     *
     * The delete is filtered by `student: user.id` as well as by lesson, so a student
     * cannot delete someone else's completion row by guessing at a lesson id.
     */
    async uncomplete(ctx) {
      const lessonDocumentId = ctx.params.id;
      const user = ctx.state.user;

      const lesson = await strapi.documents('api::lesson.lesson').findOne({
        documentId: lessonDocumentId,
        fields: ['title'],
        populate: { course: { fields: ['title'] } },
      });

      if (!lesson?.course) {
        return ctx.notFound('Lesson not found');
      }
      const course = lesson.course;

      const existingCompletion = await strapi.db
        .query('api::lesson-completion.lesson-completion')
        .findOne({
          where: {
            student: { id: user.id },
            lesson: { id: lesson.id },
          },
          select: ['id'],
        });

      if (existingCompletion) {
        await strapi.db.query('api::lesson-completion.lesson-completion').delete({
          where: { id: existingCompletion.id },
        });
      }

      return {
        data: {
          progress: await computeCourseProgress(user.id, course.id, course.documentId),
        },
      };
    },
  })
);
