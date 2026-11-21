import { attemptRepository } from './attempts.repository.js';
import { answerRepository } from './answers.repository.js';
import { contestRepository } from '../contests/contests.repository.js';
import { assignmentRepository } from '../assignments/assignments.repository.js';
import { questionRepository } from '../questions/questions.repository.js';
import { submissionRepository } from '../submissions/submissions.repository.js';
import { attendanceRepository } from '../attendance/attendance.repository.js';
import { rubricRepository } from '../rubrics/rubrics.repository.js';
import { participantRepository } from '../participants/participants.repository.js';
import { RubricEngine } from '../rubrics/rubricEngine.js';
import { executionService } from '../execution/executionService.js';
import { calculateAttemptTiming } from '../../utils/time.js';
import { ApiError } from '../../utils/ApiError.js';
import { ATTEMPT_STATUS, CONTEST_STATUS, SUBMISSION_VERDICT } from '@codeathon/shared';
import { getSocketServer } from '../../sockets/index.js';

export class AttemptsService {
  async getAssignedContests(user) {
    const participant = await participantRepository.findById(user.userId);
    const teamId = participant?.teamId || null;

    const allContests = await contestRepository.find({});
    const assignedContests = [];

    for (const contest of allContests) {
      const isAssigned = await assignmentRepository.isAssigned(contest.id, user.userId, teamId);
      if (isAssigned || user.isSuperAdmin) {
        const attempt = await attemptRepository.findByContestAndUser(contest.id, user.userId);
        
        let attemptStatus = ATTEMPT_STATUS.NOT_STARTED;
        let remainingSeconds = contest.durationMinutes * 60;
        let score = null;

        if (attempt) {
          attemptStatus = attempt.status;
          score = attempt.finalScore;
          if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
            const timing = calculateAttemptTiming(
              attempt.startedAt,
              contest.durationMinutes,
              contest.endTime,
              contest.gracePeriodMinutes || 0,
              attempt.extensionSeconds || 0
            );
            remainingSeconds = timing.remainingSeconds;
          }
        }

        assignedContests.push({
          id: contest.id,
          title: contest.title,
          description: contest.description,
          instructions: contest.instructions,
          startTime: contest.startTime,
          endTime: contest.endTime,
          durationMinutes: contest.durationMinutes,
          gracePeriodMinutes: contest.gracePeriodMinutes || 0,
          status: contest.status,
          proctorConfig: contest.proctorConfig || {},
          leaderboardConfig: contest.leaderboardConfig || {},
          attempt: attempt
            ? {
                id: attempt.id,
                status: attemptStatus,
                startedAt: attempt.startedAt,
                endsAt: attempt.endsAt,
                remainingSeconds,
                finalScore: score,
              }
            : null,
        });
      }
    }

    return assignedContests;
  }

  async startAttempt(contestId, user) {
    const contest = await contestRepository.findById(contestId);
    if (!contest) throw ApiError.notFound('Contest not found');

    const now = Date.now();
    const startWindow = new Date(contest.startTime).getTime();
    const endWindow = new Date(contest.endTime).getTime() + (contest.gracePeriodMinutes || 0) * 60 * 1000;

    if (now < startWindow && !user.isSuperAdmin) {
      throw ApiError.badRequest('Contest has not started yet. Please wait for start time.', 'CONTEST_NOT_STARTED');
    }

    if (now > endWindow && !user.isSuperAdmin) {
      throw ApiError.badRequest('Contest window has ended.', 'CONTEST_ENDED');
    }

    // Check existing attempt
    let attempt = await attemptRepository.findByContestAndUser(contestId, user.userId);

    if (attempt) {
      if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
        throw ApiError.attemptLocked();
      }
      return attempt;
    }

    // Server-authoritative start & endsAt calculation
    const startedAt = new Date().toISOString();
    const timing = calculateAttemptTiming(
      startedAt,
      contest.durationMinutes,
      contest.endTime,
      contest.gracePeriodMinutes || 0,
      0
    );

    attempt = await attemptRepository.create({
      contestId,
      userId: user.userId,
      userName: user.name,
      userRoll: user.rollNumber,
      status: ATTEMPT_STATUS.IN_PROGRESS,
      startedAt,
      endsAt: timing.endsAt,
      extensionSeconds: 0,
      finalScore: 0,
      activeSessionId: Math.random().toString(36).substring(7),
    });

    // Mark attendance Present automatically
    const existingAttendance = await attendanceRepository.findByContestAndUser(contestId, user.userId);
    const participant = await participantRepository.findById(user.userId);

    if (existingAttendance) {
      await attendanceRepository.update(existingAttendance.id, {
        status: 'present',
        testStartTimestamp: startedAt,
      });
    } else {
      await attendanceRepository.create({
        contestId,
        userId: user.userId,
        userName: user.name,
        rollNumber: user.rollNumber,
        teamId: participant?.teamId || null,
        status: 'present',
        loginStatus: 'Logged in',
        loginTimestamp: startedAt,
        testStartTimestamp: startedAt,
        submitTimestamp: null,
        durationMinutes: 0,
      });
    }

    return attempt;
  }

  async getAttemptState(contestId, user) {
    const contest = await contestRepository.findById(contestId);
    if (!contest) throw ApiError.notFound('Contest not found');

    const attempt = await attemptRepository.findByContestAndUser(contestId, user.userId);
    if (!attempt) {
      throw ApiError.badRequest('Attempt not started. Please call start first.');
    }

    const timing = calculateAttemptTiming(
      attempt.startedAt,
      contest.durationMinutes,
      contest.endTime,
      contest.gracePeriodMinutes || 0,
      attempt.extensionSeconds || 0
    );

    if (timing.isExpired && attempt.status === ATTEMPT_STATUS.IN_PROGRESS) {
      await this.finishAttempt(contestId, user, 'time_expired');
      attempt.status = ATTEMPT_STATUS.SUBMITTED;
    }

    // Fetch questions sanitized for student
    const questions = await questionRepository.findByContest(contestId);
    const sanitizedQuestions = questions.map((q) => {
      if (q.type === 'mcq') {
        return {
          id: q.id,
          sectionId: q.sectionId,
          type: 'mcq',
          title: q.title,
          statement: q.statement,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          order: q.order,
          isMultiSelect: q.isMultiSelect,
          mcqOptions: (q.mcqOptions || []).map((o) => ({ id: o.id, text: o.text })),
        };
      }
      const cfg = q.codingConfig || {};
      const toggles = cfg.displayToggles || {};
      const allTestCases = cfg.testCases || [];
      const sampleTestCases = allTestCases
        .filter((tc) => tc.isSample)
        .map((tc) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          explanation: tc.explanation,
        }));
      const hiddenCount = allTestCases.filter((tc) => tc.isHidden).length;

      return {
        id: q.id,
        sectionId: q.sectionId,
        type: 'coding',
        title: q.title,
        statement: toggles.showStatement !== false ? q.statement : '',
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        order: q.order,
        codingConfig: {
          inputFormat: toggles.showInputFormat !== false ? cfg.inputFormat : '',
          outputFormat: toggles.showOutputFormat !== false ? cfg.outputFormat : '',
          examples: toggles.showExamples !== false ? cfg.examples : '',
          constraints: toggles.showConstraints !== false ? cfg.constraints : '',
          timeLimitMs: toggles.showLimits !== false ? cfg.timeLimitMs : 2000,
          memoryLimitMb: toggles.showLimits !== false ? cfg.memoryLimitMb : 256,
          displayToggles: toggles,
          allowedLanguages: cfg.allowedLanguages || ['python', 'javascript', 'cpp', 'java'],
          starterCode: cfg.starterCode || {},
          sampleTestCases: toggles.showSampleTestCases !== false ? sampleTestCases : [],
          hiddenTestCasesCount: toggles.showHiddenTestCasesCount !== false ? hiddenCount : 0,
        },
      };
    });

    const savedAnswers = await answerRepository.findByAttempt(attempt.id);

    return {
      contest: {
        id: contest.id,
        title: contest.title,
        description: contest.description,
        instructions: contest.instructions,
        proctorConfig: contest.proctorConfig || {},
        leaderboardConfig: contest.leaderboardConfig || {},
      },
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        endsAt: timing.endsAt,
        remainingSeconds: timing.remainingSeconds,
        finalScore: attempt.finalScore,
      },
      questions: sanitizedQuestions,
      savedAnswers,
      serverTime: new Date().toISOString(),
    };
  }

  async saveAnswer(contestId, user, { questionId, selectedOptions, isMarkedForReview, draftCode, language }) {
    const attempt = await attemptRepository.findByContestAndUser(contestId, user.userId);
    if (!attempt) throw ApiError.notFound('Attempt not found');
    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
      throw ApiError.attemptLocked();
    }

    const saved = await answerRepository.upsertAnswer(attempt.id, questionId, {
      selectedOptions: selectedOptions || [],
      isMarkedForReview: !!isMarkedForReview,
      draftCode: draftCode || '',
      language: language || '',
    });

    return { savedAt: saved.updatedAt || saved.createdAt };
  }

  async runCode(contestId, user, { questionId, code, language, customInput }) {
    const question = await questionRepository.findById(questionId);
    if (!question || question.type !== 'coding') {
      throw ApiError.badRequest('Question not found or not a coding challenge');
    }

    const cfg = question.codingConfig || {};
    const timeLimitMs = cfg.timeLimitMs || 2000;
    const memoryLimitMb = cfg.memoryLimitMb || 256;

    // If custom input provided, run against custom input
    if (customInput !== undefined && customInput !== null && customInput.trim()) {
      const execResult = await executionService.executeCode({
        code,
        language,
        input: customInput,
        timeLimitMs,
        memoryLimitMb,
      });

      return {
        isCustomInput: true,
        input: customInput,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
        verdict: execResult.verdict,
        timeMs: execResult.timeMs,
      };
    }

    // Otherwise run against sample test cases
    const sampleCases = (cfg.testCases || []).filter((tc) => tc.isSample);
    const caseResults = [];

    for (let i = 0; i < sampleCases.length; i++) {
      const tc = sampleCases[i];
      const execResult = await executionService.executeCode({
        code,
        language,
        input: tc.input,
        timeLimitMs,
        memoryLimitMb,
      });

      const isMatch = executionService.compareOutput(execResult.stdout, tc.expectedOutput);
      const verdict = execResult.verdict !== SUBMISSION_VERDICT.PASSED ? execResult.verdict : isMatch ? SUBMISSION_VERDICT.PASSED : SUBMISSION_VERDICT.FAILED;

      caseResults.push({
        caseNumber: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: execResult.stdout,
        stderr: execResult.stderr,
        verdict,
        timeMs: execResult.timeMs,
        passed: verdict === SUBMISSION_VERDICT.PASSED,
      });
    }

    const allPassed = caseResults.every((c) => c.passed);

    return {
      isCustomInput: false,
      overallVerdict: allPassed ? SUBMISSION_VERDICT.PASSED : SUBMISSION_VERDICT.FAILED,
      cases: caseResults,
      totalCases: caseResults.length,
      passedCases: caseResults.filter((c) => c.passed).length,
    };
  }

  async submitCode(contestId, user, { questionId, code, language }) {
    const attempt = await attemptRepository.findByContestAndUser(contestId, user.userId);
    if (!attempt) throw ApiError.notFound('Attempt not found');
    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
      throw ApiError.attemptLocked();
    }

    const question = await questionRepository.findById(questionId);
    if (!question || question.type !== 'coding') {
      throw ApiError.badRequest('Invalid coding question');
    }

    const cfg = question.codingConfig || {};
    const testCases = cfg.testCases || [];
    const timeLimitMs = cfg.timeLimitMs || 2000;
    const memoryLimitMb = cfg.memoryLimitMb || 256;

    const caseResults = [];
    let totalScore = 0;
    let earnedScore = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const weight = Number(tc.weight) || 1;
      totalScore += weight;

      const execResult = await executionService.executeCode({
        code,
        language,
        input: tc.input,
        timeLimitMs,
        memoryLimitMb,
      });

      const isMatch = executionService.compareOutput(execResult.stdout, tc.expectedOutput);
      const verdict = execResult.verdict !== SUBMISSION_VERDICT.PASSED ? execResult.verdict : isMatch ? SUBMISSION_VERDICT.PASSED : SUBMISSION_VERDICT.FAILED;
      const passed = verdict === SUBMISSION_VERDICT.PASSED;

      if (passed) earnedScore += weight;

      caseResults.push({
        id: tc.id,
        isSample: !!tc.isSample,
        isHidden: !!tc.isHidden,
        verdict,
        passed,
        timeMs: execResult.timeMs,
        // Only include actual output/expected output for sample test cases!
        input: tc.isSample ? tc.input : undefined,
        expectedOutput: tc.isSample ? tc.expectedOutput : undefined,
        actualOutput: tc.isSample ? execResult.stdout : undefined,
        stderr: tc.isSample ? execResult.stderr : undefined,
      });
    }

    const passedCases = caseResults.filter((c) => c.passed).length;
    const totalCases = caseResults.length;
    const percentage = totalCases > 0 ? (passedCases / totalCases) * 100 : 0;
    const overallVerdict = passedCases === totalCases ? SUBMISSION_VERDICT.PASSED : SUBMISSION_VERDICT.FAILED;

    const submission = await submissionRepository.create({
      attemptId: attempt.id,
      contestId,
      userId: user.userId,
      questionId,
      code,
      language,
      verdict: overallVerdict,
      caseResults,
      score: earnedScore,
      maxScore: totalScore,
      passedCases,
      totalCases,
      percentage,
      createdAt: new Date().toISOString(),
    });

    // Also autosave current code draft
    await answerRepository.upsertAnswer(attempt.id, questionId, {
      draftCode: code,
      language,
    });

    // Strip hidden case details completely for client response
    const clientSafeCases = caseResults.map((c, idx) => ({
      caseNumber: idx + 1,
      isSample: c.isSample,
      isHidden: c.isHidden,
      verdict: c.verdict,
      passed: c.passed,
      timeMs: c.timeMs,
      input: c.isSample ? c.input : undefined,
      expectedOutput: c.isSample ? c.expectedOutput : undefined,
      actualOutput: c.isSample ? c.actualOutput : undefined,
      stderr: c.isSample ? c.stderr : undefined,
    }));

    // Emit live submission event
    const io = getSocketServer();
    if (io) {
      io.to(`admin:contest:${contestId}`).emit('submission:result', {
        submissionId: submission.id,
        userId: user.userId,
        userName: user.name,
        questionId,
        verdict: overallVerdict,
        passedCases,
        totalCases,
      });
    }

    return {
      submissionId: submission.id,
      verdict: overallVerdict,
      passedCases,
      totalCases,
      earnedScore,
      maxScore: totalScore,
      cases: clientSafeCases,
    };
  }

  async finishAttempt(contestId, user, reason = 'user_submit') {
    const attempt = await attemptRepository.findByContestAndUser(contestId, user.userId);
    if (!attempt) throw ApiError.notFound('Attempt not found');
    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
      return attempt;
    }

    const contest = await contestRepository.findById(contestId);
    const questions = await questionRepository.findByContest(contestId);
    const answers = await answerRepository.findByAttempt(attempt.id);
    const rubric = contest?.rubricId ? await rubricRepository.findById(contest.rubricId) : null;

    // Grade MCQs
    let totalMcq = 0;
    let correctMcq = 0;
    let mcqScore = 0;

    const mcqQuestions = questions.filter((q) => q.type === 'mcq');
    for (const q of mcqQuestions) {
      totalMcq++;
      const ans = answers.find((a) => a.questionId === q.id);
      const selected = ans?.selectedOptions || [];
      const correctOptionIds = (q.mcqOptions || []).filter((o) => o.isCorrect).map((o) => o.id);

      const isCorrect =
        selected.length > 0 &&
        selected.length === correctOptionIds.length &&
        selected.every((id) => correctOptionIds.includes(id));

      if (isCorrect) {
        correctMcq++;
        mcqScore += Number(q.marks) || 10;
      } else if (selected.length > 0 && q.negativeMarks) {
        mcqScore -= Number(q.negativeMarks);
      }
    }

    const mcqAccuracy = totalMcq > 0 ? (correctMcq / totalMcq) * 100 : 100;

    // Grade Coding Submissions
    const codingQuestions = questions.filter((q) => q.type === 'coding');
    let totalSampleCases = 0;
    let passedSampleCases = 0;
    let totalHiddenCases = 0;
    let passedHiddenCases = 0;
    let codingScore = 0;

    for (const q of codingQuestions) {
      const latestSub = await submissionRepository.findLatestByAttemptAndQuestion(attempt.id, q.id);
      if (latestSub && latestSub.caseResults) {
        for (const tc of latestSub.caseResults) {
          if (tc.isSample) {
            totalSampleCases++;
            if (tc.passed) passedSampleCases++;
          }
          if (tc.isHidden) {
            totalHiddenCases++;
            if (tc.passed) passedHiddenCases++;
          }
        }
        codingScore += latestSub.score || 0;
      }
    }

    const sampleCasesPassedPct = totalSampleCases > 0 ? (passedSampleCases / totalSampleCases) * 100 : 100;
    const hiddenCasesPassedPct = totalHiddenCases > 0 ? (passedHiddenCases / totalHiddenCases) * 100 : 100;
    const totalCases = totalSampleCases + totalHiddenCases;
    const passedCases = passedSampleCases + passedHiddenCases;
    const testCasesPassedPct = totalCases > 0 ? (passedCases / totalCases) * 100 : 100;

    const now = new Date();
    const startTimeMs = new Date(attempt.startedAt).getTime();
    const completionTimeSeconds = Math.max(0, Math.floor((now.getTime() - startTimeMs) / 1000));

    // Calculate final score using Rubric Engine
    const finalScore = RubricEngine.calculateScore(rubric, {
      mcqAccuracy,
      sampleCasesPassedPct,
      hiddenCasesPassedPct,
      testCasesPassedPct,
      totalDurationMinutes: contest?.durationMinutes || 60,
      completionTimeSeconds,
      wrongAttempts: 0,
      avgRuntimeMs: 80,
    });

    const submittedAt = now.toISOString();

    const updatedAttempt = await attemptRepository.update(attempt.id, {
      status: ATTEMPT_STATUS.SUBMITTED,
      submittedAt,
      submissionReason: reason,
      finalScore,
      mcqScore: Math.max(0, mcqScore),
      codingScore,
      completionTimeSeconds,
      metrics: {
        mcqAccuracy,
        sampleCasesPassedPct,
        hiddenCasesPassedPct,
        passedCases,
        totalCases,
      },
    });

    // Update Attendance
    const attendance = await attendanceRepository.findByContestAndUser(contestId, user.userId);
    if (attendance) {
      const durationMins = Math.round(completionTimeSeconds / 60);
      await attendanceRepository.update(attendance.id, {
        status: 'completed',
        submitTimestamp: submittedAt,
        durationMinutes: durationMins,
      });
    }

    // Emit live leaderboard update
    const io = getSocketServer();
    if (io) {
      io.to(`contest:${contestId}`).emit('leaderboard:update', {
        contestId,
        userId: user.userId,
        finalScore,
      });
    }

    return updatedAttempt;
  }
}

export const attemptsService = new AttemptsService();
