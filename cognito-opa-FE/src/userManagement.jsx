import { useState } from "react";
import axios from "axios";
import { useAuth } from "react-oidc-context";

const API_BASE = "https://5x207ye1rl.execute-api.us-east-1.amazonaws.com";

// All groups that exist in your Cognito pool
const ALL_GROUPS = ["admin", "developer", "tester", "viewer", "superAdmin"];

export default function UserManagement() {
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [discoveredUser, setDiscoveredUser] = useState(null); // { username, email, sub, currentGroups }
  const [discoverError, setDiscoverError] = useState("");
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [selectedGroups, setSelectedGroups] = useState([]);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [applyError, setApplyError] = useState("");

  // Read roles from access token
  const accessToken = auth.user?.access_token;
  const payload = accessToken
    ? JSON.parse(atob(accessToken.split(".")[1]))
    : null;
  const roles = payload?.["cognito:groups"] || payload?.roles || [];
  const isSuperAdmin = roles.includes("superAdmin");

  // Don't render at all if not superAdmin
  if (!isSuperAdmin) return null;

  // ── User Discovery ──────────────────────────────────────────────
  const handleEmailBlur = async () => {
    if (!email || !email.includes("@")) return;

    setDiscoverLoading(true);
    setDiscoveredUser(null);
    setDiscoverError("");
    setSelectedGroups([]);
    setApplyResult(null);
    setApplyError("");

    try {
      const res = await axios.post(
        `${API_BASE}/userManage/discover`,
        { email },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setDiscoveredUser(res.data);
      setSelectedGroups(res.data.currentGroups); // pre-select current groups
    } catch (err) {
      if (err.response?.status === 404) {
        setDiscoverError("No user found with that email.");
      } else {
        setDiscoverError("Failed to look up user. Try again.");
      }
    } finally {
      setDiscoverLoading(false);
    }
  };

  // ── Multiselect toggle ──────────────────────────────────────────
  const toggleGroup = (group) => {
    setSelectedGroups(prev =>
      prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  // ── Apply ───────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!discoveredUser) return;

    setApplyLoading(true);
    setApplyResult(null);
    setApplyError("");

    try {
      const res = await axios.post(
        `${API_BASE}/userManage/apply`,
        {
          username: discoveredUser.username,
          newGroups: selectedGroups,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setApplyResult(res.data);
      // Update the card to reflect new groups
      setDiscoveredUser(prev => ({ ...prev, currentGroups: selectedGroups }));
    } catch (err) {
      setApplyError(err.response?.data?.message || "Failed to apply changes.");
    } finally {
      setApplyLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>User Management</h2>
      <p style={styles.subtext}>SuperAdmin only — manage Cognito group assignments</p>

      {/* Email Input */}
      <div style={styles.section}>
        <label style={styles.label}>User Email</label>
        <input
          style={styles.input}
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
        />
        {discoverLoading && <p style={styles.info}>Looking up user...</p>}
        {discoverError && <p style={styles.error}>{discoverError}</p>}
      </div>

      {/* User Card */}
      {discoveredUser && (
        <div style={styles.card}>
          <p><strong>Email:</strong> {discoveredUser.email}</p>
          <p><strong>Username:</strong> {discoveredUser.username}</p>
          <p><strong>Sub:</strong> {discoveredUser.sub}</p>
          <p><strong>Current Groups:</strong> {discoveredUser.currentGroups.join(", ") || "None"}</p>
        </div>
      )}

      {/* Group Multiselect */}
      {discoveredUser && (
        <div style={styles.section}>
          <label style={styles.label}>Assign Groups</label>
          <div style={styles.groupGrid}>
            {ALL_GROUPS.map(group => (
              <button
                key={group}
                onClick={() => toggleGroup(group)}
                style={{
                  ...styles.groupBtn,
                  ...(selectedGroups.includes(group) ? styles.groupBtnActive : {}),
                }}
              >
                {group}
              </button>
            ))}
          </div>
          <p style={styles.info}>
            Selected: {selectedGroups.length > 0 ? selectedGroups.join(", ") : "None"}
          </p>
        </div>
      )}

      {/* Apply Button */}
      {discoveredUser && (
        <button
          style={styles.applyBtn}
          onClick={handleApply}
          disabled={applyLoading}
        >
          {applyLoading ? "Applying..." : "Apply Changes"}
        </button>
      )}

      {/* Result / Error */}
      {applyResult && (
        <div style={styles.success}>
          ✅ Done — Added: [{applyResult.added.join(", ") || "none"}] | Removed: [{applyResult.removed.join(", ") || "none"}]
        </div>
      )}
      {applyError && <p style={styles.error}>{applyError}</p>}
    </div>
  );
}

const styles = {
  container: { maxWidth: 520, margin: "2rem auto", fontFamily: "sans-serif", padding: "0 1rem" },
  heading: { marginBottom: 4 },
  subtext: { color: "#dcdcdc", marginBottom: "1.5rem", fontSize: 13 },
  section: { marginBottom: "1.5rem" },
  label: { display: "block", fontWeight: 600, marginBottom: 6 },
  input: { width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" },
  card: { background: "#f5f5f5", borderRadius: 8, padding: "12px 16px", marginBottom: "1.5rem", fontSize: 14, lineHeight: 1.8 },
  groupGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  groupBtn: { padding: "6px 14px", borderRadius: 20, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 13 },
  groupBtnActive: { background: "#1a73e8", color: "#fff", border: "1px solid #1a73e8" },
  applyBtn: { width: "100%", padding: "10px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer", marginBottom: "1rem" },
  success: { background: "#e6f4ea", color: "#2e7d32", borderRadius: 8, padding: "10px 14px", fontSize: 14 },
  info: { color: "#555", fontSize: 13, marginTop: 6 },
  error: { color: "#c62828", fontSize: 13, marginTop: 6 },
};