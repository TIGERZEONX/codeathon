import { z } from 'zod';

export const createParticipantSchema = z.object({
  rollNumber: z.string().min(2, 'Roll Number / ID is required'),
  name: z.string().min(2, 'Full Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').default('Codeathon@123'),
  department: z.string().optional().default('Computer Science'),
  yearOrSemester: z.string().optional().default('Final Year'),
});

export const updateParticipantSchema = createParticipantSchema.partial();

export const bulkCreateParticipantsSchema = z.object({
  participants: z.array(createParticipantSchema),
});

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Team name is required'),
  description: z.string().optional().default(''),
  leaderId: z.string().optional(),
  memberIds: z.array(z.string()).default([]),
});

export const assignParticipantsSchema = z.object({
  contestId: z.string().min(1, 'Contest ID is required'),
  participantIds: z.array(z.string()).optional().default([]),
  teamIds: z.array(z.string()).optional().default([]),
});

export type CreateParticipantInput = z.infer<typeof createParticipantSchema>;
export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AssignParticipantsInput = z.infer<typeof assignParticipantsSchema>;
