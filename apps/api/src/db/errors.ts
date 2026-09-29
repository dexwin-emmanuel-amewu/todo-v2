export type NotFoundError = { type: "not_found"; id: string };
export type ValidationError = { type: "validation"; issues: string[] };
export type DatabaseError = { type: "database"; cause: unknown };

export type TodosRepositoryError = NotFoundError | ValidationError | DatabaseError;
