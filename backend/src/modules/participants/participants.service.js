import { participantRepository } from './participants.repository.js';
import { userRepository } from '../users/users.repository.js';
import { teamRepository } from '../teams/teams.repository.js';
import { hashPassword } from '../../utils/password.js';
import { ApiError } from '../../utils/ApiError.js';
import { SYSTEM_ROLES } from '@codeathon/shared';
import { parseCsv } from '../../utils/csv.js';

export class ParticipantsService {
  async getAllParticipants(options = {}) {
    let list = await participantRepository.find({});
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.rollNumber.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }
    if (options.teamId) {
      list = list.filter((p) => p.teamId === options.teamId);
    }
    return list;
  }

  async getParticipantById(id) {
    const item = await participantRepository.findById(id);
    if (!item) throw ApiError.notFound('Participant not found');
    return item;
  }

  async createParticipant(data) {
    const rollUpper = data.rollNumber.toUpperCase();
    const existingRoll = await participantRepository.findByRollNumber(rollUpper);
    if (existingRoll) {
      throw ApiError.conflict(`Participant with Roll Number ${rollUpper} already exists`);
    }

    const emailLower = data.email.toLowerCase();
    const existingEmail = await userRepository.findByEmail(emailLower);
    if (existingEmail) {
      throw ApiError.conflict(`User with email ${emailLower} already exists`);
    }

    const hashedPassword = await hashPassword(data.password || 'Codeathon@123');

    // Create participant user login
    const user = await userRepository.create({
      name: data.name,
      email: emailLower,
      rollNumber: rollUpper,
      password: hashedPassword,
      role: SYSTEM_ROLES.STUDENT,
      roleId: SYSTEM_ROLES.STUDENT,
      roleName: 'Student',
      isActive: true,
    });

    const participant = await participantRepository.create({
      id: user.id,
      userId: user.id,
      rollNumber: rollUpper,
      name: data.name,
      email: emailLower,
      department: data.department || 'Computer Science',
      yearOrSemester: data.yearOrSemester || 'Final Year',
      teamId: data.teamId || null,
      plainPasswordPreview: data.password || 'Codeathon@123',
    });

    return participant;
  }

  async bulkImportCsv(csvString) {
    const rows = parseCsv(csvString);
    if (!rows.length) {
      throw ApiError.badRequest('CSV content is empty or headers are missing. Required: rollNumber, name, email');
    }

    const results = {
      imported: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const rollNumber = row.rollNumber || row['Roll Number'] || row.roll_no;
        const name = row.name || row['Name'] || row.fullName;
        const email = row.email || row['Email'];
        const department = row.department || row['Department'] || 'Computer Science';
        const password = row.password || row['Password'] || 'Codeathon@123';

        if (!rollNumber || !name || !email) {
          throw new Error('Missing required fields: rollNumber, name, or email');
        }

        await this.createParticipant({
          rollNumber,
          name,
          email,
          department,
          password,
        });
        results.imported++;
      } catch (err) {
        results.errors.push({ row: i + 2, error: err.message });
      }
    }

    return results;
  }

  async updateParticipant(id, updates) {
    const item = await participantRepository.findById(id);
    if (!item) throw ApiError.notFound('Participant not found');

    if (updates.name || updates.department || updates.teamId !== undefined) {
      await participantRepository.update(id, {
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.department ? { department: updates.department } : {}),
        ...(updates.teamId !== undefined ? { teamId: updates.teamId } : {}),
      });
      await userRepository.update(id, {
        ...(updates.name ? { name: updates.name } : {}),
      });
    }

    return participantRepository.findById(id);
  }

  async deleteParticipant(id) {
    const item = await participantRepository.findById(id);
    if (!item) throw ApiError.notFound('Participant not found');
    await participantRepository.delete(id);
    await userRepository.delete(id);
    return true;
  }
}

export const participantsService = new ParticipantsService();
