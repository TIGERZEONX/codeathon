import { BaseRepository } from '../../utils/baseRepository.js';

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    if (!email) return null;
    return this.findOne({ email: email.toLowerCase() });
  }

  async findByIdentifier(identifier) {
    if (!identifier) return null;
    const lower = identifier.toLowerCase();
    const all = await this.find({});
    return (
      all.find(
        (u) =>
          u.email.toLowerCase() === lower ||
          (u.rollNumber && u.rollNumber.toLowerCase() === lower)
      ) || null
    );
  }
}

export const userRepository = new UserRepository();
