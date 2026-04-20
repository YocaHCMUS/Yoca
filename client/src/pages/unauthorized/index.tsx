import {
  ErrorLayout,
  ERROR_ACTION_GROUP_CLASSNAMES,
  ERROR_PRIMARY_ACTION_CLASSNAMES,
  ERROR_SECONDARY_ACTION_CLASSNAMES,
} from "@/components/error/ErrorLayout";
import { useLocation, useNavigate } from "react-router";

const HOME_ROUTE = "/";
const LOGIN_ROUTE = "/auth";

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

  const requestedPath = getRequestedPath(location.state);

  return (
    <ErrorLayout
      code={ERROR_CODE}
      title={ERROR_TITLE}
      description={ERROR_DESCRIPTION}
      detail={
        requestedPath.length > 0 ? (
          <span>
            {PROTECTED_PATH_LABEL}{" "}
            <span className="font-medium text-neutral-100">{requestedPath}</span>
          </span>
        ) : undefined
      }
      actions={
        <div className={ERROR_ACTION_GROUP_CLASSNAMES}>
          <button
            type="button"
            onClick={() => navigate(LOGIN_ROUTE)}
            className={ERROR_PRIMARY_ACTION_CLASSNAMES}
          >
            {LOGIN_BUTTON_LABEL}
          </button>

          <button
            type="button"
            onClick={() => navigate(HOME_ROUTE)}
            className={ERROR_SECONDARY_ACTION_CLASSNAMES}
          >
            {HOME_BUTTON_LABEL}
          </button>
        </div>
      }
    />
  );
}
