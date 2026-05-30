import { SignInModal } from "@/components/auth";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";

const HOME_ROUTE = "/";

const ERROR_CODE = "401";
const ERROR_TITLE = "Access Denied";
const ERROR_DESCRIPTION =
  "You need to sign in before accessing this protected area.";

const LOGIN_BUTTON_LABEL = "Go to Login";
const HOME_BUTTON_LABEL = "Back to Home";
const PROTECTED_PATH_LABEL = "Protected path:";

type UnauthorizedRouteState = {
  from?: string;
};

function getRequestedPath(state: unknown): string {
  if (typeof state !== "object" || state === null) {
    return "";
  }

  if (!("from" in state)) {
    return "";
  }

  const routeState = state as UnauthorizedRouteState;
  if (typeof routeState.from !== "string") {
    return "";
  }

  return routeState.from;
}

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  const requestedPath = getRequestedPath(location.state);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-center items-center bg-[#161616] overflow-hidden font-sans px-8 md:px-16 lg:px-32">
      <div className="flex flex-col items-center text-center max-w-4xl w-full mx-auto gap-10">
        <div className="flex flex-col items-center gap-3 w-full">
          <p
            className="text-[#c6c6c6] font-semibold uppercase tracking-widest"
            style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.125rem)" }}
          >
            {ERROR_CODE} Error
          </p>

          <h1
            className="text-[#f4f4f4] font-bold tracking-tight leading-none"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5.5rem)" }}
          >
            {ERROR_TITLE}
          </h1>

          <p
            className="text-[#c6c6c6] leading-snug max-w-2xl"
            style={{ fontSize: "clamp(1rem, 1.5vw, 1.25rem)" }}
          >
            {ERROR_DESCRIPTION}
          </p>

          {requestedPath.length > 0 ? (
            <p
              className="text-[#c6c6c6] leading-snug max-w-2xl"
              style={{ fontSize: "clamp(0.875rem, 1.2vw, 1rem)" }}
            >
              {PROTECTED_PATH_LABEL}{" "}
              <span className="font-medium text-[#f4f4f4]">{requestedPath}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setIsSignInOpen(true)}
            className="bg-[#0f62fe] hover:bg-[#0353e9] text-white font-semibold px-4 py-3 whitespace-nowrap transition-colors"
          >
            {LOGIN_BUTTON_LABEL}
          </button>

          <button
            type="button"
            onClick={() => navigate(HOME_ROUTE)}
            className="text-[#78a9ff] hover:text-[#a6c8ff] hover:bg-[#353535] px-4 py-3 font-medium text-base transition-colors"
          >
            {HOME_BUTTON_LABEL}
          </button>
        </div>
      </div>

      <SignInModal
        open={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        redirectUrl={requestedPath}
      />
    </div>
  );
}
