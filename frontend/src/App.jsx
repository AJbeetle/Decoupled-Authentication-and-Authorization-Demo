import { useAuth } from "react-oidc-context";
import axios from "axios";
import { useState } from "react";
import "./App.css";
import UserManagement from "./userManagement";

function App() {
  const auth = useAuth();
  const [response, setResponse] = useState("");
  const [localMessage, setLocalMessage] = useState(false);
  const [image, setImage] = useState("");

  const globalLogout = () => {
    const clientId = "4m74b1gro60gobfgnkj5ehdvj0";
    const logoutUri = "https://eks-fe.learnc.online";
    const cognitoDomain =
      "https://us-east-1js2bzx6lt.auth.us-east-1.amazoncognito.com";

    alert("Cognito Session Logged out");

    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;

    localLogout();
  };

  const localLogout = () => {
    auth.removeUser();
    setLocalMessage((t) => !t);
    setResponse("");
  };

  const requestAccess = async (endpoint) => {
    try {
      const res = await axios.get(
        `https://5x207ye1rl.execute-api.us-east-1.amazonaws.com/${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user?.access_token}`,
          },
        }
      );

      if (res.status === 200) {
        setResponse(`✅ ${endpoint} access granted`);
        setImage(res.data.imageUrl);
      }
    } catch (err) {
      if (err.response) {
        setResponse(
          `❌ ${endpoint} error (${err.response.status}) ${JSON.stringify(
            err.response?.data
          )}`
        );
      } else {
        setResponse("⚠️ Backend server not reachable");
      }
      setImage("");
    }
  };

  if (auth.isLoading) return <div className="center">Loading...</div>;
  if (auth.error) return <div className="center">Error: {auth.error.message}</div>;

  if (auth.isAuthenticated) {
    return (
      <div className="container">
        <h2>Welcome {auth.user?.profile.email}</h2>

        <h3>Access Control Panel</h3>

        <div className="button-group">
          <button onClick={() => requestAccess("admin")}>Admin</button>
          <button onClick={() => requestAccess("tester")}>Tester</button>
          <button onClick={() => requestAccess("dev")}>Developer</button>
          <button onClick={() => requestAccess("viewer")}>User</button>
        </div>

        {image && (
          <div className="image-container">
            <img src={image} alt="result" />
          </div>
        )}

        <div className="logout-group">
          <button className="secondary" onClick={localLogout}>
            Local Logout
          </button>
          <button className="danger" onClick={globalLogout}>
            Global Logout
          </button>
        </div>

        <h3 className="response">{response}</h3>

        <div className="token-box">
          <details>
            <summary>Show Authentication Tokens</summary>

            <h4>ID Token</h4>
            <textarea readOnly value={auth.user?.id_token} />

            <h4>Access Token</h4>
            <textarea readOnly value={auth.user?.access_token} />

            <h4>Refresh Token</h4>
            <textarea readOnly value={auth.user?.refresh_token} />
          </details>
        </div>

        <div>
          <h1>USER MANAGEMENT : Conditional Rendering</h1>
          <UserManagement/>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h2>Cognito Login</h2>

      <button onClick={() => auth.signinRedirect()}>Sign In</button>

      {localMessage && (
        <p className="info-text">
          App Session Logged Out, Cognito Session still persists
        </p>
      )}
    </div>
  );
}

export default App;