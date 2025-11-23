import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import App from "./App.tsx";
import "./App.css";
import "./index.scss";
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";

const apiDomain: string = import.meta.env.CLIENT_API_DOMAIN;

console.log(`API Domain in client 1: ${apiDomain}`);

const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: `${apiDomain}/graphql` }),
  cache: new InMemoryCache(),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <App />
    </ApolloProvider>
  </StrictMode>,
);
