import React from "react";

export const HoverContext = React.createContext<{
  hoveredToken: string | null;
  setHoveredToken: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredPair: string | null;
  setHoveredPair: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredAddress: string | null;
  setHoveredAddress: React.Dispatch<React.SetStateAction<string | null>>;
}>({
  hoveredToken: null,
  setHoveredToken: () => {},
  hoveredPair: null,
  setHoveredPair: () => {},
  hoveredAddress: null,
  setHoveredAddress: () => {},
});
