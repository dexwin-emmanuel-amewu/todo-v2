import { z } from "zod";

export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(6).max(100),
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type Todo = z.infer<typeof todoSchema>;

export const createTodoSchema = todoSchema.pick({ title: true });

export type CreateTodoInput = z.infer<typeof createTodoSchema>;

export const todoListResponseSchema = z.object({
  items: z.array(todoSchema),
});

export type TodoListResponse = z.infer<typeof todoListResponseSchema>;

export const todoStatusFilterSchema = z.enum(["all", "active", "completed"]);

export type TodoStatusFilter = z.infer<typeof todoStatusFilterSchema>;

export const validationErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal("validation"),
    issues: z.array(z.string()),
  }),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export const internalErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal("internal"),
  }),
});

export type InternalErrorResponse = z.infer<typeof internalErrorResponseSchema>;
