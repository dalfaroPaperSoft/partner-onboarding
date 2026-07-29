import {
  AcceptPartialResponseSchema,
  CreateOrResumeSessionResponseSchema,
  GetSessionResponseSchema,
  GoLiveResponseSchema,
  ResetSessionResponseSchema,
  SaveDetailsResponseSchema,
  ValidateIntegrationResponseSchema,
  type GoLiveResponse,
  type OnboardingSession,
  type SaveDetailsRequest,
} from "@partner-onboarding/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { ApiClientError, apiRequest } from "./client";

const SESSION_QUERY_KEY = ["onboarding-session"] as const;

function createOrResumeSession(): Promise<OnboardingSession> {
  return apiRequest(
    "/api/onboarding/sessions",
    CreateOrResumeSessionResponseSchema,
    { method: "POST" },
  );
}

function getSession(sessionId: string): Promise<OnboardingSession> {
  return apiRequest(
    `/api/onboarding/sessions/${sessionId}`,
    GetSessionResponseSchema,
  );
}

export function useOnboardingSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: createOrResumeSession,
    retry: false,
    staleTime: 30_000,
  });
}

export function useRefreshSession() {
  const queryClient = useQueryClient();

  return async (sessionId: string): Promise<OnboardingSession> => {
    const session = await getSession(sessionId);
    queryClient.setQueryData(SESSION_QUERY_KEY, session);
    return session;
  };
}

export function useSaveDetails(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveDetailsRequest) =>
      apiRequest(
        `/api/onboarding/sessions/${sessionId}/details`,
        SaveDetailsResponseSchema,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

export function useValidateIntegration(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/onboarding/sessions/${sessionId}/validation`,
        ValidateIntegrationResponseSchema,
        { method: "POST" },
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
    onError: async (error) => {
      if (
        error instanceof ApiClientError &&
        error.code === "STALE_VALIDATION_RESULT"
      ) {
        const session = await getSession(sessionId);
        queryClient.setQueryData(SESSION_QUERY_KEY, session);
      }
    },
  });
}

export function useAcceptPartial(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/onboarding/sessions/${sessionId}/accept-partial`,
        AcceptPartialResponseSchema,
        { method: "POST" },
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

export function useResetSession(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest(
        `/api/onboarding/sessions/${sessionId}/reset`,
        ResetSessionResponseSchema,
        { method: "POST" },
      ),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

export function useGoLive(sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation<GoLiveResponse, Error>({
    mutationFn: () =>
      apiRequest(
        `/api/onboarding/sessions/${sessionId}/go-live`,
        GoLiveResponseSchema,
        { method: "POST" },
      ),
    onSuccess: ({ session }) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
    onError: async () => {
      try {
        const session = await getSession(sessionId);
        queryClient.setQueryData(SESSION_QUERY_KEY, session);
      } catch {
        // Preserve the original mutation error; the UI offers another retry.
      }
    },
  });
}
