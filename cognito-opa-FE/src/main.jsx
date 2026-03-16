import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "react-oidc-context";

const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_js2Bzx6Lt",
  client_id: "4m74b1gro60gobfgnkj5ehdvj0",
  redirect_uri: "http://localhost:3000",
  response_type: "code",
  scope: "email openid phone",
  extraQueryParams: {
    prompt: "select_account"
  }
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);