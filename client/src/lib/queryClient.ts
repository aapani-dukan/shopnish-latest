// client/src/lib/queryClient.ts

import { QueryClient, QueryFunction } from "@tanstack/react-query";
import api from "./api"; // ✅ axios इंस्टेंस को यहाँ आयात करें
import { signOutUser } from "@/lib/firebase";

/**
 * एक सामान्य API अनुरोध फ़ंक्शन जो `axios` का उपयोग करता है।
 * Axios स्वचालित रूप से हेडर में Firebase टोकन को इंटरसेप्टर के माध्यम से जोड़ता है।
 */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  data?: unknown | FormData
): Promise<any> {
  try {
    const config = {
      method,
      url: path,
      data,
    };
    const res = await api(config);
    return res.data;
  } catch (error: any) {
    if (error.response) {
      // ✅ Custom error बनाओ जिसमें status भी preserve हो
      const customError: any = new Error(
        error.response.data.message ||
          error.response.data.error ||
          "API request failed"
      );
      customError.status = error.response.status;

      if (error.response.status === 401) {
        console.error("401 Unauthorized: Logging out user.");
        signOutUser(); // या जो भी आपका लॉगआउट फ़ंक्शन है
        throw customError;
      }

      throw customError;
    }
    const customError: any = new Error("An unexpected error occurred.");
    customError.status = 500;
    throw customError;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T | null> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey[0] as string;

    try {
      const res = await apiRequest("GET", path);
      return res as T;
    } catch (error: any) {
      if (error.status === 401 && unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: any) => {
        if (error?.status === 401 && failureCount < 1) {
          console.log("401 Error detected. Attempting to refresh token...");
          return true;
        }
        return false;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
