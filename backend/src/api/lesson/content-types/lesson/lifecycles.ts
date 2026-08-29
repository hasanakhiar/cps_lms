/**
 * Lesson lifecycle hooks.
 *
 * When a lesson is deleted its completion rows become orphans. Left alone they
 * would still be counted, so a student could show 4/3 lessons complete.
 * Deleting them here keeps every percentage correct without a cleanup job.
 */
export default {
  async afterDelete(event: { result: { id?: number } }) {
    const { result } = event;
    if (!result?.id) return;
    await strapi.db.query('api::lesson-completion.lesson-completion').deleteMany({
      where: { lesson: result.id },
    });
  },
};
