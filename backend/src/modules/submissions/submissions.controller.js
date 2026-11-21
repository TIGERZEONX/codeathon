import { submissionsService } from './submissions.service.js';
import { successResponse } from '../../utils/response.js';

export class SubmissionsController {
  async getLocked(req, res) {
    const list = await submissionsService.getLockedSubmissions(req.query.contestId);
    return successResponse(res, list);
  }

  async revoke(req, res) {
    const result = await submissionsService.revokeSubmission(req.user, req.body);
    return successResponse(res, result);
  }
}

export const submissionsController = new SubmissionsController();
