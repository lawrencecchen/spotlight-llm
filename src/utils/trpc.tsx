import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createWSClient, wsLink } from "@trpc/client/links/wsLink";
import { createTRPCReact } from "@trpc/react-query";
import React, { useState } from "react";
import superjson from "superjson";
import { type AppRouter } from "../../server/router";

export const trpc = createTRPCReact<AppRouter>();

// const TRPC_URL = "http://localhost:8080/trpc";
const TRPC_WS_URL = "ws://localhost:8080/";

function getEndingLink() {
  const client = createWSClient({
    url: TRPC_WS_URL,
  });
  return wsLink<AppRouter>({
    client,
  });
}

export function TRPCProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [getEndingLink()],
      transformer: superjson,
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
