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

export const todoIdParamSchema = z.uuid();

export type TodoIdParam = z.infer<typeof todoIdParamSchema>;

export const todoStatusFilterSchema = z.enum(["all", "active", "completed"]);

export type TodoStatusFilter = z.infer<typeof todoStatusFilterSchema>;

export const todoSearchQuerySchema = z.string().trim().max(100);

export type TodoSearchQuery = z.infer<typeof todoSearchQuerySchema>;

export const todoPageQuerySchema = z.coerce.number().int().min(1);

export type TodoPageQuery = z.infer<typeof todoPageQuerySchema>;

export const todoPageSizeQuerySchema = z.coerce.number().int().min(1).max(100);

export type TodoPageSizeQuery = z.infer<typeof todoPageSizeQuerySchema>;

export const todoListResponseSchema = z.object({
  items: z.array(todoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type TodoListResponse = z.infer<typeof todoListResponseSchema>;

export const validationErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal("validation"),
    issues: z.array(z.string()),
  }),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

export const notFoundErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal("not_found"),
  }),
});

export type NotFoundErrorResponse = z.infer<typeof notFoundErrorResponseSchema>;

export const internalErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal("internal"),
  }),
});

export type InternalErrorResponse = z.infer<typeof internalErrorResponseSchema>;
