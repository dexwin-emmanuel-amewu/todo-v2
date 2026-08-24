import { z } from "zod";

export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(6).max(100),
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

export const internalErrorResponseSchema = z.object({
  error: z.object({ type: z.literal("internal") }),
});

export type InternalErrorResponse = z.infer<typeof internalErrorResponseSchema>;
