import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "./app-error.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
    },
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of error.issues) {
      const path = issue.path.join(".") || "request";
      fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
    }

    response.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fieldErrors,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      },
    });
    return;
  }

  console.error("Unhandled API error", error);
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
