export class RubricEngine {
  /**
   * Calculates overall weighted score (0 to 100) based on rubric criteria
   */
  static calculateScore(rubric, metrics) {
    if (!rubric || !rubric.criteria || !rubric.criteria.length) {
      // Default fallback score if no rubric attached: 40% MCQ + 60% Coding
      const mcqScore = metrics.mcqAccuracy || 0;
      const codingScore = metrics.testCasesPassedPct || 0;
      return Math.round(mcqScore * 0.4 + codingScore * 0.6);
    }

    let finalScore = 0;
    let totalWeight = 0;

    for (const crit of rubric.criteria) {
      const weight = Number(crit.weight) || 0;
      totalWeight += weight;
      let criterionScore = 0;

      const nameLower = (crit.name || '').toLowerCase();
      const type = crit.type || '';

      if (
        type === 'mcq_accuracy' ||
        nameLower.includes('mcq') ||
        nameLower.includes('knowledge') ||
        nameLower.includes('aptitude') ||
        nameLower.includes('quiz')
      ) {
        criterionScore = Math.min(100, Math.max(0, metrics.mcqAccuracy || 0));
      } else if (
        type === 'hidden_test_cases_passed_pct' ||
        nameLower.includes('hidden')
      ) {
        criterionScore = Math.min(100, Math.max(0, metrics.hiddenCasesPassedPct ?? metrics.testCasesPassedPct ?? 0));
      } else if (
        type === 'test_cases_passed_pct' ||
        nameLower.includes('test case') ||
        nameLower.includes('correctness') ||
        nameLower.includes('logic') ||
        nameLower.includes('functionality') ||
        nameLower.includes('coding')
      ) {
        criterionScore = Math.min(100, Math.max(0, metrics.testCasesPassedPct ?? metrics.sampleCasesPassedPct ?? 0));
      } else if (
        type === 'completion_time' ||
        nameLower.includes('time') ||
        nameLower.includes('speed')
      ) {
        const totalDuration = metrics.totalDurationMinutes || 60;
        const timeTaken = (metrics.completionTimeSeconds || 0) / 60;
        const ratio = Math.max(0.1, (totalDuration - timeTaken) / totalDuration);
        criterionScore = Math.round(Math.min(100, ratio * 100));
      } else if (
        type === 'runtime_efficiency' ||
        nameLower.includes('efficiency') ||
        nameLower.includes('performance') ||
        nameLower.includes('quality') ||
        nameLower.includes('clean')
      ) {
        const passingRate = metrics.testCasesPassedPct || 0;
        criterionScore = Math.round(passingRate * 0.85 + 15);
      } else {
        const passingRate = metrics.testCasesPassedPct || 0;
        const mcqRate = metrics.mcqAccuracy || 0;
        criterionScore = Math.round(passingRate * 0.7 + mcqRate * 0.3);
      }

      finalScore += (criterionScore * weight) / 100;
    }

    if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.01) {
      finalScore = finalScore / (totalWeight / 100);
    }

    return Math.min(100, Math.max(0, Math.round(finalScore)));
  }
}
