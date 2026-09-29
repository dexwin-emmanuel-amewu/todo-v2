import { z } from "zod";

//just to put something here. might change in the future
export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(6).max(100),
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type Todo = z.infer<typeof todoSchema>;

export const createTodoSchema = todoSchema.pick({ title: true });

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
//change things here
