import { factories } from '@strapi/strapi';
import { scopeFindToOwnStudentRows } from '../../../utils/scope-find';

export default factories.createCoreController('api::enrollment.enrollment', ({ strapi }) => ({
  /**
   * Leak test 3: `GET /api/enrollments?populate=*` as a student must return that
   * student's rows and nothing else. See `scopeFindToOwnStudentRows` for why the
   * filters and populate are replaced rather than merged.
   */
  async find(ctx) {
    await scopeFindToOwnStudentRows(ctx, 'api::enrollment.enrollment', {
      course: { fields: ['documentId', 'title', 'slug', 'coverImageUrl'] },
    });
    return super.find(ctx);
  },
}));
