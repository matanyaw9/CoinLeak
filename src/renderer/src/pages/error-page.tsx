// Shown for unknown routes and for a screen that crashed while rendering.
// Never shows the error text itself: it could hold transaction data.

import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Compass, TriangleAlert } from "lucide-react";
import { s } from "@/strings";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export function ErrorPage({ notFound: unknownRoute }: { notFound?: boolean }) {
  const error = useRouteError();
  const notFound = unknownRoute || (isRouteErrorResponse(error) && error.status === 404);
  return (
    <div className="flex h-full items-center justify-center bg-background p-8">
      <EmptyState
        icon={notFound ? Compass : TriangleAlert}
        title={notFound ? s.errors.notFoundTitle : s.errors.crashTitle}
        body={notFound ? s.errors.notFoundBody : s.errors.crashBody}
        action={
          <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {s.errors.goHome}
          </Link>
        }
      />
    </div>
  );
}
