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

    for (const crit of rubric.criteria) {
      const weight = Number(crit.weight) / 100;
      let criterionScore = 0;

      switch (crit.type) {
        case 'mcq_accuracy':
          criterionScore = Math.min(100, Math.max(0, metrics.mcqAccuracy || 0));
          break;

        case 'test_cases_passed_pct':
          criterionScore = Math.min(100, Math.max(0, metrics.sampleCasesPassedPct || metrics.testCasesPassedPct || 0));
          break;

        case 'hidden_test_cases_passed_pct':
          criterionScore = Math.min(100, Math.max(0, metrics.hiddenCasesPassedPct || 0));
          break;

        case 'completion_time': {
          // If finished in less than duration, award points proportional to remaining time
          const totalDuration = metrics.totalDurationMinutes || 60;
          const timeTaken = (metrics.completionTimeSeconds || 0) / 60;
          const ratio = Math.max(0, (totalDuration - timeTaken) / totalDuration);
          criterionScore = Math.round(ratio * 100);
          break;
        }

        case 'attempts_penalty': {
          // Deduct 5 points per non-passing run attempt beyond 2
          const wrongAttempts = metrics.wrongAttempts || 0;
          criterionScore = Math.max(0, 100 - wrongAttempts * 5);
          break;
        }

        case 'runtime_efficiency': {
          // Average runtime < 200ms gets full marks, scales down to 0 at 2000ms
          const avgRuntimeMs = metrics.avgRuntimeMs || 100;
          criterionScore = Math.max(0, Math.min(100, Math.round(100 - (avgRuntimeMs / 2000) * 100)));
          break;
        }

        case 'code_quality_manual':
          criterionScore = Math.min(100, Math.max(0, metrics.manualCodeQualityScore || 80));
          break;

        default:
          criterionScore = 50;
      }

      finalScore += criterionScore * weight;
    }

    return Math.round(finalScore);
  }
}
