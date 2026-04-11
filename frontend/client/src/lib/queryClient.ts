// client/src/lib/queryClient.ts

import { QueryClient, QueryFunction } from "@tanstack/react-query";
import api from "./api"; // ✅ axios इंस्टेंस को यहाँ आयात करें
import { signOutUser } from "@/lib/firebase";
//import { any } from "zod";

/**
 * एक सामान्य API अनुरोध फ़ंक्शन जो `axios` का उपयोग करता है।
 * Axios स्वचालित रूप से हेडर में Firebase टोकन को इंटरसेप्टर के माध्यम से जोड़ता है।
 */
export async function apiRequest <T = any>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  data?: unknown | FormData
): Promise<T> {
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

// Standard function syntax use karein, isme 'T' ka scope ekdum clear rehta hai
export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T | null> {
  
  return async ({ queryKey }) => {
    const path = queryKey[0] as string;

    try {
      // ✅ Ab yahan 'T' par koi error nahi aayega
      const res = await apiRequest<T>("GET", path);
      return res;
    } catch (error: any) {
      // 401 check (Unauthorized)
      if (error.status === 401 && options.on401 === "returnNull") {
        return null;
      }
      throw error;
    }
  };
}

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
