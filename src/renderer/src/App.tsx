// The window's root: query cache, hash router, shared month and sync state,
// tooltips and toasts.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { MonthProvider } from "@/lib/month-context";
import { SyncProvider } from "@/lib/sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home-page";
import { TransactionsPage } from "@/pages/transactions-page";
import { CategoriesPage } from "@/pages/categories-page";
import { AccountsPage } from "@/pages/accounts-page";
import { SettingsPage } from "@/pages/settings-page";
import { ErrorPage } from "@/pages/error-page";

const queryClient = new QueryClient({
  defaultOptions: {
    // Local IPC does not flake; a failure is a real answer worth showing.
    queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const router = createHashRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/transactions", element: <TransactionsPage /> },
      { path: "/categories", element: <CategoriesPage /> },
      { path: "/accounts", element: <AccountsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <ErrorPage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MonthProvider>
        <SyncProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </SyncProvider>
      </MonthProvider>
    </QueryClientProvider>
  );
}
