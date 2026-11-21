import { rubricRepository } from './rubrics.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { v4 as uuidv4 } from 'uuid';

export class RubricsService {
  async getAllRubrics() {
    return rubricRepository.find({});
  }

  async getRubricById(id) {
    const rubric = await rubricRepository.findById(id);
    if (!rubric) throw ApiError.notFound('Rubric not found');
    return rubric;
  }

  async createRubric(data) {
    const criteria = (data.criteria || []).map((c) => ({
      ...c,
      id: c.id || uuidv4(),
    }));

    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
    if (Math.round(totalWeight) !== 100) {
      throw ApiError.badRequest(`Criteria weights must sum to exactly 100%. Current sum: ${totalWeight}%`);
    }

    return rubricRepository.create({
      ...data,
      criteria,
      isPredefined: false,
    });
  }

  async cloneRubric(id, newName) {
    const original = await rubricRepository.findById(id);
    if (!original) throw ApiError.notFound('Original rubric not found');

    return rubricRepository.create({
      name: newName || `${original.name} (Clone)`,
      description: original.description,
      criteria: original.criteria.map((c) => ({ ...c, id: uuidv4() })),
      isPredefined: false,
    });
  }

  async updateRubric(id, updates) {
    const rubric = await rubricRepository.findById(id);
    if (!rubric) throw ApiError.notFound('Rubric not found');
    if (rubric.isPredefined) {
      throw ApiError.badRequest('Predefined rubrics are read-only. Please clone them to create a custom variation.');
    }

    if (updates.criteria) {
      const criteria = updates.criteria.map((c) => ({
        ...c,
        id: c.id || uuidv4(),
      }));
      const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
      if (Math.round(totalWeight) !== 100) {
        throw ApiError.badRequest(`Criteria weights must sum to exactly 100%. Current sum: ${totalWeight}%`);
      }
      updates.criteria = criteria;
    }

    return rubricRepository.update(id, updates);
  }

  async deleteRubric(id) {
    const rubric = await rubricRepository.findById(id);
    if (!rubric) throw ApiError.notFound('Rubric not found');
    if (rubric.isPredefined) {
      throw ApiError.badRequest('Cannot delete predefined system rubrics');
    }
    return rubricRepository.delete(id);
  }
}

export const rubricsService = new RubricsService();
