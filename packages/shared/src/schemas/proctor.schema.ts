import { z } from 'zod';
import { PROCTOR_VIOLATION_TYPE } from '../constants/statuses.js';

export const logProctorEventSchema = z.object({
  contestId: z.string().min(1),
  attemptId: z.string().min(1),
  type: z.enum([
    PROCTOR_VIOLATION_TYPE.TAB_SWITCH,
    PROCTOR_VIOLATION_TYPE.WINDOW_BLUR,
    PROCTOR_VIOLATION_TYPE.COPY,
    PROCTOR_VIOLATION_TYPE.PASTE,
    PROCTOR_VIOLATION_TYPE.CUT,
    PROCTOR_VIOLATION_TYPE.CONTEXT_MENU,
    PROCTOR_VIOLATION_TYPE.FULLSCREEN_EXIT,
    PROCTOR_VIOLATION_TYPE.DEVTOOLS_OPEN,
    PROCTOR_VIOLATION_TYPE.PRINT_SCREEN,
    PROCTOR_VIOLATION_TYPE.TEXT_SELECTION,
  ]),
  timestamp: z.string().datetime().optional(),
  details: z.record(z.any()).optional().default({}),
});

export type LogProctorEventInput = z.infer<typeof logProctorEventSchema>;
