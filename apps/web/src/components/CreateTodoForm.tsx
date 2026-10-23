import { createTodoSchema } from "@todo/contracts";
import { match, P } from "ts-pattern";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TodoApiError } from "../api/todo.api";
import { useCreateTodoMutation } from "../hooks/useCreateTodoMutation";

const inputId = "new-todo-title";
const validationId = "new-todo-validation";

export function CreateTodoForm() {
  const [title, setTitle] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useCreateTodoMutation();

  useEffect(() => {
    if (successMessage && !mutation.isPending) inputRef.current?.focus();
  }, [mutation.isPending, successMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;

    setRequestMessage(null);
    setSuccessMessage(null);
    const parsed = createTodoSchema.safeParse({ title });
    if (!parsed.success) {
      const normalizedTitle = title.trim();
      const message =
        normalizedTitle.length === 0
          ? "Enter a todo title."
          : normalizedTitle.length < 6
            ? "Use at least 6 characters."
            : "Keep the title to 100 characters or fewer.";
      setValidationMessage(message);
      inputRef.current?.focus();
      return;
    }

    setValidationMessage(null);
    try {
      await mutation.mutateAsync(parsed.data.title);
      setTitle("");
      setSuccessMessage("Todo added.");
    } catch (error) {
      const message = match(error)
        .with(P.instanceOf(TodoApiError), ({ type }) =>
          match(type)
            .with(
              "network",
              () => "Could not reach the server. Check your connection and try again.",
            )
            .with("http", () => "The server could not add this todo. Try again.")
            .with("request_validation", () => "Enter a valid todo title.")
            .with(
              "response_validation",
              () => "The server returned an unexpected response. Try again.",
            )
            .exhaustive(),
        )
        .otherwise((unexpectedError) => {
          console.error("Unexpected error while creating a todo", unexpectedError);
          return "Something went wrong. Your todo was not added. Try again.";
        });
      setRequestMessage(message);
    }
  }

  return (
    <section aria-label="Add a todo" className="mb-5">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
            Todo title
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="title"
            type="text"
            value={title}
            maxLength={100}
            aria-invalid={validationMessage ? true : undefined}
            aria-describedby={validationMessage ? validationId : undefined}
            onChange={(event) => {
              setTitle(event.currentTarget.value);
              setValidationMessage(null);
              setRequestMessage(null);
              setSuccessMessage(null);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:bg-slate-100"
            placeholder="What needs doing?"
            disabled={mutation.isPending}
          />
          {validationMessage && (
            <p id={validationId} className="mt-1 text-sm text-red-700">
              {validationMessage}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:bg-slate-500"
        >
          {mutation.isPending ? "Adding…" : "Add todo"}
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true" className="min-h-6 pt-1 text-sm">
        {successMessage && <p className="text-emerald-800">{successMessage}</p>}
      </div>
      {requestMessage && (
        <p
          role="alert"
          className="mt-1 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {requestMessage}
        </p>
      )}
    </section>
  );
}
