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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden font-sans">
      <div className="absolute top-0 left-1/4 w-[40rem] h-[40rem] bg-[#9945FF] rounded-full mix-blend-screen filter blur-[128px] opacity-30 animate-pulse pointer-events-none"></div>
      <div
        className="absolute bottom-0 right-1/4 w-[40rem] h-[40rem] bg-[#14F195] rounded-full mix-blend-screen filter blur-[128px] opacity-30 animate-pulse pointer-events-none"
        style={{ animationDelay: "2s" }}
      ></div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <span className="text-[15rem] md:text-[25rem] xl:text-[35rem] font-bold text-white opacity-[0.03]">
          {ERROR_CODE}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-7xl w-full mx-4 p-8 gap-12">
        <div className="flex flex-col items-center gap-4 w-full max-w-7xl">
          <p
            className="text-neutral-400 font-semibold uppercase tracking-widest"
            style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.125rem)" }}
          >
            {ERROR_CODE} Error
          </p>

          <h1
            className="text-white font-bold tracking-tight leading-none my-2"
            style={{ fontSize: "clamp(2.5rem, 6vw, 5.5rem)" }}
          >
            {ERROR_TITLE}
          </h1>

          <p
            className="text-neutral-300 leading-snug max-w-4xl"
            style={{ fontSize: "clamp(1rem, 1.5vw, 1.5rem)" }}
          >
            {ERROR_DESCRIPTION}
          </p>

          {requestedPath.length > 0 ? (
            <p
              className="text-neutral-300 leading-snug max-w-4xl"
              style={{ fontSize: "clamp(1rem, 1.5vw, 1.5rem)" }}
            >
              {PROTECTED_PATH_LABEL}{" "}
              <span className="font-medium text-neutral-100">{requestedPath}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-4">
          <button
            type="button"
            onClick={() => setIsSignInOpen(true)}
            className="bg-[#14F195] hover:bg-[#10c87e] text-black font-bold px-8 py-3 rounded whitespace-nowrap transition-colors"
          >
            {LOGIN_BUTTON_LABEL}
          </button>

          <button
            type="button"
            onClick={() => navigate(HOME_ROUTE)}
            className="text-[#14F195] hover:text-white font-medium text-lg transition-colors"
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
