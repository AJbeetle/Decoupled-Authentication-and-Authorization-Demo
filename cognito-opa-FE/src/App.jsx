import { useAuth } from "react-oidc-context";

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "4m74b1gro60gobfgnkj5ehdvj0";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain =
      "https://us-east-1js2bzx6lt.auth.us-east-1.amazoncognito.com";
      
    auth.removeUser();

    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}`;
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div>
        <h2>Welcome</h2>

        <pre>Email: {auth.user?.profile.email}</pre>

        <pre>ID Token:</pre>
        <textarea rows="6" cols="80">
          {auth.user?.id_token}
        </textarea>

        <pre>Access Token:</pre>
        <textarea rows="6" cols="80">
          {auth.user?.access_token}
        </textarea>

        <br />

        <button onClick={() => auth.removeUser()}>
          Local Sign out
        </button>

        <button onClick={signOutRedirect}>
          Global Sign out
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Cognito Login Demo</h2>

      <button onClick={() => auth.signinRedirect()}>
        Sign in with Cognito
      </button>

      <button onClick={signOutRedirect}>
        Sign out
      </button>
    </div>
  );
}

export default App;