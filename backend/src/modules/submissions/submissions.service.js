import { attemptRepository } from '../attempts/attempts.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { ATTEMPT_STATUS } from '@codeathon/shared';
import { getSocketServer } from '../../sockets/index.js';

export class SubmissionsService {
  async getLockedSubmissions(contestId = null) {
    const query = { status: ATTEMPT_STATUS.SUBMITTED };
    if (contestId) query.contestId = contestId;

    const list = await attemptRepository.find(query);
    list.sort((a, b) => new Date(b.submittedAt || b.updatedAt).getTime() - new Date(a.submittedAt || a.updatedAt).getTime());
    return list;
  }

  async revokeSubmission(user, { attemptId, reason, extensionMinutes = 0 }) {
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw ApiError.notFound('Attempt not found');
    if (attempt.status !== ATTEMPT_STATUS.SUBMITTED) {
      throw ApiError.badRequest('Can only revoke submitted / locked attempts');
    }

    const addedSeconds = (extensionMinutes || 0) * 60;
    const currentExtension = attempt.extensionSeconds || 0;

    const updated = await attemptRepository.update(attemptId, {
      status: ATTEMPT_STATUS.REVOKED_REOPENED,
      extensionSeconds: currentExtension + addedSeconds,
      revokedBy: user.userId,
      revokedByName: user.name,
      revocationReason: reason,
      revokedAt: new Date().toISOString(),
    });

    // Write to audit log
    await auditRepository.create({
      userId: user.userId,
      userName: user.name,
      action: 'SUBMISSION_REVOKED',
      details: {
        attemptId,
        studentId: attempt.userId,
        studentName: attempt.userName,
        contestId: attempt.contestId,
        reason,
        extensionMinutes,
      },
      createdAt: new Date().toISOString(),
    });

    // Emit Socket.IO event to student's room
    const io = getSocketServer();
    if (io) {
      io.to(`attempt:${attemptId}`).emit('attempt:revoked', {
        attemptId,
        reason,
        extensionMinutes,
      });
      io.to(`admin:contest:${attempt.contestId}`).emit('attempt:revoked', {
        attemptId,
        studentName: attempt.userName,
        reason,
      });
    }

    return updated;
  }
}

export const submissionsService = new SubmissionsService();
