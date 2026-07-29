import type {
  OnboardingSession,
  ValidationStatus,
} from "@partner-onboarding/contracts";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../App";

const sessionId = "c50b0c68-3019-4d3f-aa79-803ee45336f4";
const timestamp = "2026-07-29T12:00:00.000Z";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function session(
  input: Partial<OnboardingSession> & {
    validationStatus?: ValidationStatus;
  } = {},
): OnboardingSession {
  const { validationStatus, ...overrides } = input;

  return {
    id: sessionId,
    status: "DETAILS_REQUIRED",
    currentStep: "details",
    details: {
      companyName: null,
      providerAccountId: null,
      hasProviderApiKey: false,
    },
    validation: {
      status: validationStatus ?? "not_started",
      items: [],
      warnings: [],
      reason: null,
      partialAcceptedAt: null,
    },
    allowedActions: ["save_details"],
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockResponses(...responses: unknown[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(jsonResponse(response));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("Onboarding wizard", () => {
  it("saves initial details and advances from the server response", async () => {
    const user = userEvent.setup();
    const readyToValidate = session({
      status: "READY_TO_VALIDATE",
      currentStep: "validation",
      details: {
        companyName: "Example Partner",
        providerAccountId: "account-123",
        hasProviderApiKey: true,
      },
      allowedActions: ["save_details", "validate"],
    });
    const fetchMock = mockResponses(session(), readyToValidate);

    renderApp();
    await screen.findByRole("heading", {
      name: "Tell us about your company",
    });

    await user.type(screen.getByLabelText("Company name"), "Example Partner");
    await user.type(
      screen.getByLabelText("Provider account ID"),
      "account-123",
    );
    await user.type(screen.getByLabelText("Provider API key"), "valid_key");
    await user.click(screen.getByRole("button", { name: "Save and continue" }));

    await screen.findByRole("heading", {
      name: "Validate your Provider connection",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/onboarding/sessions/${sessionId}/details`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          companyName: "Example Partner",
          providerAccountId: "account-123",
          providerApiKey: "valid_key",
        }),
      }),
    );
  });

  it("shows retry recovery for an unavailable Provider", async () => {
    mockResponses(
      session({
        status: "INTEGRATION_UNAVAILABLE",
        currentStep: "validation",
        validationStatus: "unavailable",
        details: {
          companyName: "Example Partner",
          providerAccountId: "account-123",
          hasProviderApiKey: true,
        },
        validation: {
          status: "unavailable",
          items: [],
          warnings: [],
          reason: "Provider temporarily unavailable",
          partialAcceptedAt: null,
        },
        allowedActions: ["save_details", "retry_validation"],
      }),
    );

    renderApp();

    expect(
      await screen.findByText("Provider temporarily unavailable", {
        selector: "strong",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry validation" }),
    ).toBeEnabled();
  });

  it("accepts a partial result and advances to review", async () => {
    const user = userEvent.setup();
    const partial = session({
      status: "READY_TO_VALIDATE",
      currentStep: "validation",
      validationStatus: "partial",
      details: {
        companyName: "Example Partner",
        providerAccountId: "account-123",
        hasProviderApiKey: true,
      },
      validation: {
        status: "partial",
        items: [{ id: "item-1", name: "Primary item" }],
        warnings: ["One item could not be loaded"],
        reason: null,
        partialAcceptedAt: null,
      },
      allowedActions: [
        "save_details",
        "retry_validation",
        "accept_partial",
      ],
    });
    const accepted = session({
      ...partial,
      status: "READY_TO_GO_LIVE",
      currentStep: "review",
      validation: {
        ...partial.validation,
        partialAcceptedAt: timestamp,
      },
      allowedActions: ["save_details", "retry_validation", "go_live"],
    });
    mockResponses(partial, accepted);

    renderApp();
    await user.click(
      await screen.findByRole("button", {
        name: "Accept warnings and continue",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Review and go live" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Proceeding with accepted warnings")).toBeVisible();
  });

  it("allows credential editing from review without exposing the saved key", async () => {
    const user = userEvent.setup();
    mockResponses(
      session({
        status: "READY_TO_GO_LIVE",
        currentStep: "review",
        validationStatus: "valid",
        details: {
          companyName: "Example Partner",
          providerAccountId: "account-123",
          hasProviderApiKey: true,
        },
        validation: {
          status: "valid",
          items: [{ id: "item-1", name: "Primary item" }],
          warnings: [],
          reason: null,
          partialAcceptedAt: null,
        },
        allowedActions: ["save_details", "retry_validation", "go_live"],
      }),
    );

    renderApp();
    await user.click(
      await screen.findByRole("button", { name: "Edit details" }),
    );

    expect(screen.getByLabelText("Company name")).toHaveValue(
      "Example Partner",
    );
    expect(screen.getByLabelText("Provider account ID")).toHaveValue(
      "account-123",
    );
    expect(screen.getByLabelText("Provider API key")).toHaveValue("");
    expect(screen.getByLabelText("Provider API key")).toHaveAttribute(
      "placeholder",
      "Leave blank to keep the saved key",
    );
  });

  it("resumes directly to the terminal completion screen", async () => {
    mockResponses(
      session({
        status: "COMPLETED",
        currentStep: "complete",
        validationStatus: "valid",
        details: {
          companyName: "Example Partner",
          providerAccountId: "account-123",
          hasProviderApiKey: true,
        },
        completedAt: timestamp,
        allowedActions: [],
      }),
    );

    renderApp();

    expect(
      await screen.findByRole("heading", {
        name: "Example Partner is live",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset session" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Go live" }),
    ).not.toBeInTheDocument();
  });

  it("resets the existing session from the header", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const completed = session({
      status: "COMPLETED",
      currentStep: "complete",
      validationStatus: "valid",
      details: {
        companyName: "Example Partner",
        providerAccountId: "account-123",
        hasProviderApiKey: true,
      },
      completedAt: timestamp,
      allowedActions: [],
    });
    const reset = session({
      updatedAt: "2026-07-29T12:05:00.000Z",
    });
    const fetchMock = mockResponses(completed, reset);

    renderApp();
    await user.click(
      await screen.findByRole("button", { name: "Reset session" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Tell us about your company",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Company name")).toHaveValue("");
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/onboarding/sessions/${sessionId}/reset`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});
