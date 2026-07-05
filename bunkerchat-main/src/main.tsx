import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { BunkerIndex } from "@/routes/index";
import "./styles.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BunkerIndex />
        <Toaster theme="dark" position="top-center" richColors />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
