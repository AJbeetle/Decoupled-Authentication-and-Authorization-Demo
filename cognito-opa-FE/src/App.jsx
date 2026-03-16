import { useAuth } from "react-oidc-context";
import axios from "axios";
import { useState } from "react";

function App() {
  const auth = useAuth();
  const [response, setResponse] = useState("");

  const [LocalMessage, setLocalMessage] = useState(false);

  // GLOBAL LOGOUT (Cognito)
  const globalLogout = () => {
    const clientId = "4m74b1gro60gobfgnkj5ehdvj0";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain =
      "https://us-east-1js2bzx6lt.auth.us-east-1.amazoncognito.com";
    
    alert("Cognito Session Logged out");

    window.location.href =
      `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
        logoutUri
      )}`;
    
    localLogout();
  };

  // LOCAL LOGOUT (remove tokens only)
  const localLogout = () => {
    auth.removeUser();
    setLocalMessage(t=>!t);
    setResponse("");
  };

  // Backend access request
  const requestAccess = async (endpoint) => {
    try {
      const res = await axios.post(`http://localhost:5000/${endpoint}`, {
        access_token: auth.user?.access_token,
        id_token: auth.user?.id_token,
      });

      if (res.status === 200) {
        setResponse(`✅ ${endpoint} access granted`);
      }
    } catch (err) {
      if (err.response) {
        if (err.response.status === 403) {
          setResponse(`❌ ${endpoint} access denied (403 Forbidden)`);
        } else if (err.response.status === 404) {
          setResponse(`⚠️ Backend route not found (404)`);
        } else {
          setResponse(`⚠️ Error: ${err.response.status}`);
        }
      } else {
        setResponse("⚠️ Backend server not reachable");
      }
    }
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  // USER LOGGED IN
  if (auth.isAuthenticated) {
    return (
      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <h2>Welcome {auth.user?.profile.email}</h2>

        <h3>Access Control Panel</h3>

        <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
          <button onClick={() => requestAccess("admin")}>
            Admin Access
          </button>

          <button onClick={() => requestAccess("tester")}>
            Tester Access
          </button>

          <button onClick={() => requestAccess("developer")}>
            Developer Access
          </button>

          <button onClick={() => requestAccess("user")}>
            User Access
          </button>
        </div>

        <br />

        {/* LOGOUT BUTTONS */}
        <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
          <button onClick={localLogout}>
            Local Logout
          </button>

          <button onClick={globalLogout}>
            Global Logout
          </button>
        </div>

        <h3>{response}</h3>

        {/* COLLAPSIBLE TOKEN VIEW */}
        <div
          style={{
            marginTop: "40px",
            textAlign: "left",
            width: "80%",
            marginInline: "auto",
          }}
        >
          <details>
            <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
              Show Authentication Tokens
            </summary>

            <div style={{ marginTop: "20px" }}>
              <h4>ID Token</h4>
              <textarea
                rows="6"
                style={{ width: "100%" }}
                readOnly
                value={auth.user?.id_token}
              />

              <h4>Access Token</h4>
              <textarea
                rows="6"
                style={{ width: "100%" }}
                readOnly
                value={auth.user?.access_token}
              />

              <h4>Refresh Token</h4>
              <textarea
                rows="4"
                style={{ width: "100%" }}
                readOnly
                value={auth.user?.refresh_token}
              />
            </div>
          </details>
        </div>
      </div>
    );
  }

  // LOGIN PAGE
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Cognito Login</h2>

      <button onClick={() => auth.signinRedirect()}>
        Sign in
      </button>

      {
        LocalMessage && 
        <div>
          <br></br>
          App Session Logged Out, Cognito Session still persists
         </div> 
      }

      {

      }
    </div>
  );
}

export default App;