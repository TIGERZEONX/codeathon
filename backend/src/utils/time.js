export const calculateAttemptTiming = (startedAt, durationMinutes, contestEndAt, graceMinutes = 0, extensionSeconds = 0) => {
  const startMs = new Date(startedAt).getTime();
  const maxContestEndMs = new Date(contestEndAt).getTime() + graceMinutes * 60 * 1000;
  const durationEndMs = startMs + durationMinutes * 60 * 1000 + extensionSeconds * 1000;

  // The attempt ends at the earlier of (start + duration + extension) and (contestEnd + grace)
  const endsAtMs = Math.min(durationEndMs, maxContestEndMs);
  const nowMs = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));
  const isExpired = remainingSeconds <= 0;

  return {
    endsAt: new Date(endsAtMs).toISOString(),
    remainingSeconds,
    isExpired,
  };
};

export const isAttemptActive = (attempt, contest) => {
  if (!attempt || (attempt.status !== 'in_progress' && attempt.status !== 'revoked_reopened')) return false;
  const timing = calculateAttemptTiming(
    attempt.startedAt,
    contest.durationMinutes,
    contest.endTime,
    contest.gracePeriodMinutes || 0,
    attempt.extensionSeconds || 0
  );
  return !timing.isExpired;
};
