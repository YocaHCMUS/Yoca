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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden font-sans">
      <div className="absolute top-0 left-1/4 w-[40rem] h-[40rem] bg-[#9945FF] rounded-full mix-blend-screen filter blur-[128px] opacity-30 animate-pulse pointer-events-none"></div>
      <div
        className="absolute bottom-0 right-1/4 w-[40rem] h-[40rem] bg-[#14F195] rounded-full mix-blend-screen filter blur-[128px] opacity-30 animate-pulse pointer-events-none"
        style={{ animationDelay: "2s" }}
      ></div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
        <span className="text-[15rem] md:text-[25rem] xl:text-[35rem] font-bold text-white opacity-[0.03]">
          404
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full mx-4 p-8 gap-12">
        <div className="flex flex-col items-center gap-3">
          <p className="text-neutral-400 font-semibold uppercase tracking-wider text-sm">
            {ERROR_LABEL}
          </p>

          <h1 className="text-white text-6xl md:text-7xl lg:text-8xl font-bold">
            {ERROR_TITLE}
          </h1>

          <p className="text-neutral-300 text-xl md:text-2xl">
            {ERROR_DESCRIPTION}
          </p>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row w-full gap-4"
        >
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="flex-1 bg-neutral-900 text-white border border-neutral-600 rounded px-4 py-3 focus:outline-none focus:border-emerald-500"
            autoComplete="off"
            aria-label={SEARCH_PLACEHOLDER}
          />
          <button
            type="submit"
            className="bg-[#14F195] hover:bg-[#10c87e] text-black font-bold px-6 py-3 rounded whitespace-nowrap transition-colors"
          >
            {SEARCH_BUTTON_LABEL}
          </button>
        </form>

        <div>
          <h2 className="text-2xl text-white font-semibold mb-6">
            Continue exploring
          </h2>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-8 md:gap-16">
            <button
              type="button"
              onClick={() => navigate(HOME_ROUTE)}
              className="text-[#14F195] hover:text-white font-medium text-lg transition-colors flex items-center gap-2"
            >
              Back to Homepage
            </button>
            <button
              type="button"
              onClick={() => navigate(MARKET_ROUTE)}
              className="text-[#14F195] hover:text-white font-medium text-lg transition-colors flex items-center gap-2"
            >
              Go to Market
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
