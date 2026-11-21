import { BaseRepository } from '../../utils/baseRepository.js';

class RubricRepository extends BaseRepository {
  constructor() {
    super('rubrics');
    this.seedPredefinedRubrics();
  }

  seedPredefinedRubrics() {
    // 1. Balanced Rubric
    this.create({
      id: 'rubric_balanced',
      name: 'Balanced (Standard)',
      description: 'Evenly balanced between MCQ accuracy, test cases passed, and speed.',
      isPredefined: true,
      criteria: [
        { id: 'crit_1', name: 'MCQ Accuracy', type: 'mcq_accuracy', weight: 30, description: 'Percentage of MCQ questions answered correctly' },
        { id: 'crit_2', name: 'Sample Test Cases Passed', type: 'test_cases_passed_pct', weight: 20, description: 'Percentage of sample test cases passed' },
        { id: 'crit_3', name: 'Hidden Test Cases Passed', type: 'hidden_test_cases_passed_pct', weight: 40, description: 'Percentage of hidden test cases passed' },
        { id: 'crit_4', name: 'Completion Time', type: 'completion_time', weight: 10, description: 'Bonus score for early contest submission' },
      ],
    });

    // 2. Accuracy-First Rubric
    this.create({
      id: 'rubric_accuracy_first',
      name: 'Accuracy-First',
      description: 'Prioritizes total test case correctness and hidden case coverage over completion speed.',
      isPredefined: true,
      criteria: [
        { id: 'crit_acc_1', name: 'Hidden Test Cases Passed', type: 'hidden_test_cases_passed_pct', weight: 60, description: 'Maximum weight on hidden edge cases' },
        { id: 'crit_acc_2', name: 'Sample Test Cases Passed', type: 'test_cases_passed_pct', weight: 25, description: 'Weight on sample test cases' },
        { id: 'crit_acc_3', name: 'MCQ Accuracy', type: 'mcq_accuracy', weight: 15, description: 'Accuracy in conceptual MCQ questions' },
      ],
    });

    // 3. Speed-First Rubric
    this.create({
      id: 'rubric_speed_first',
      name: 'Speed-First',
      description: 'Places heavy weight on rapid turnaround and minimal wrong submissions / penalties.',
      isPredefined: true,
      criteria: [
        { id: 'crit_spd_1', name: 'Hidden Test Cases Passed', type: 'hidden_test_cases_passed_pct', weight: 40, description: 'Correctness on edge cases' },
        { id: 'crit_spd_2', name: 'Completion Speed', type: 'completion_time', weight: 30, description: 'Points proportional to time remaining' },
        { id: 'crit_spd_3', name: 'Attempts / Penalties', type: 'attempts_penalty', weight: 15, description: 'Penalty reduction for wrong run attempts' },
        { id: 'crit_spd_4', name: 'Runtime Efficiency', type: 'runtime_efficiency', weight: 15, description: 'Execution execution time and memory footprint' },
      ],
    });
  }
}

export const rubricRepository = new RubricRepository();
