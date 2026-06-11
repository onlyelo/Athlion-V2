import { QueryClient } from '@tanstack/react-query';

// État serveur centralisé. L'invalidation en cascade reflète le principe
// « tout réagit à l'état athlète » (cf. ARCHITECTURE.md).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
