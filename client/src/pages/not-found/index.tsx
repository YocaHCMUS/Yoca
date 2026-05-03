import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";

const HOME_ROUTE = "/";
const MARKET_ROUTE = "/market";

const ERROR_LABEL = "404 Error";
const ERROR_TITLE = "We're sorry!";
const ERROR_DESCRIPTION =
  "The page you requested does not exist or may have moved to another location.";

const SEARCH_PLACEHOLDER = "Search wallet, token symbol, or pair";
const SEARCH_BUTTON_LABEL = "Search";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

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
    <div className="fixed inset-0 z-[100] flex flex-col justify-center items-center bg-[#161616] overflow-hidden font-sans px-8 md:px-16 lg:px-32">
      <div className="flex flex-col items-center text-center max-w-4xl w-full mx-auto gap-10">
        <div className="flex flex-col items-center gap-3 w-full">
          <p
            className="text-[#c6c6c6] font-semibold uppercase tracking-widest"
            style={{ fontSize: "clamp(0.875rem, 1.2vw, 1.125rem)" }}
          >
            {ERROR_LABEL}
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
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row w-full max-w-2xl mx-auto gap-0"
        >
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="flex-1 bg-[#393939] border-b border-[#8d8d8d] text-[#f4f4f4] rounded-none px-4 py-3 focus:outline-none focus:border-b-2 focus:border-[#4589ff] placeholder-[#6f6f6f]"
            autoComplete="off"
            aria-label={SEARCH_PLACEHOLDER}
          />
          <button
            type="submit"
            className="bg-[#0f62fe] hover:bg-[#0353e9] text-white font-semibold px-6 py-3 whitespace-nowrap transition-colors"
          >
            {SEARCH_BUTTON_LABEL}
          </button>
        </form>

        <div className="flex flex-col items-start w-full max-w-2xl mx-auto gap-4 mt-4">
          <h2 className="text-[#c6c6c6] text-base font-normal">
            Continue exploring
          </h2>
          <div className="flex flex-col sm:flex-row items-start gap-2 -ml-4">
            <button
              type="button"
              onClick={() => navigate(HOME_ROUTE)}
              className="text-[#78a9ff] hover:text-[#a6c8ff] hover:bg-[#353535] px-4 py-3 font-medium text-base transition-colors"
            >
              Back to Homepage
            </button>
            <button
              type="button"
              onClick={() => navigate(MARKET_ROUTE)}
              className="text-[#78a9ff] hover:text-[#a6c8ff] hover:bg-[#353535] px-4 py-3 font-medium text-base transition-colors"
            >
              Go to Market
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
