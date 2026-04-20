import {
  ErrorLayout,
  ERROR_ACTION_GROUP_CLASSNAMES,
  ERROR_PRIMARY_ACTION_CLASSNAMES,
  ERROR_SECONDARY_ACTION_CLASSNAMES,
} from "@/components/error/ErrorLayout";
import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const HOME_ROUTE = "/";
const MARKET_ROUTE = "/market";

const ERROR_CODE = "404";
const ERROR_TITLE = "We're sorry!";
const ERROR_DESCRIPTION =
  "The page you requested does not exist or may have moved to another location.";

const SEARCH_PLACEHOLDER = "Search wallet, token symbol, or pair";
const SEARCH_BUTTON_LABEL = "Search Market";
const HOME_BUTTON_LABEL = "Back to Home";
const REQUESTED_PATH_LABEL = "Requested path:";

const SEARCH_FORM_CLASSNAMES = "flex w-full max-w-2xl flex-col gap-3 sm:flex-row";

const SEARCH_INPUT_CLASSNAMES =
  "h-12 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950";

function decodePathSafely(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const requestedPath = decodePathSafely(location.pathname);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm.length === 0) {
      navigate(MARKET_ROUTE);
      return;
    }

    navigate(`${MARKET_ROUTE}?q=${encodeURIComponent(trimmedSearchTerm)}`);
  };

  return (
    <ErrorLayout
      code={ERROR_CODE}
      title={ERROR_TITLE}
      description={ERROR_DESCRIPTION}
      detail={
        <span>
          {REQUESTED_PATH_LABEL}{" "}
          <span className="font-medium text-neutral-100">{requestedPath}</span>
        </span>
      }
      actions={
        <div className={ERROR_ACTION_GROUP_CLASSNAMES}>
          <form onSubmit={handleSearchSubmit} className={SEARCH_FORM_CLASSNAMES}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className={SEARCH_INPUT_CLASSNAMES}
              autoComplete="off"
              aria-label={SEARCH_PLACEHOLDER}
            />
            <button type="submit" className={ERROR_PRIMARY_ACTION_CLASSNAMES}>
              {SEARCH_BUTTON_LABEL}
            </button>
          </form>

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
