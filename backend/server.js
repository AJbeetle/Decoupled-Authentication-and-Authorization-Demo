import express from "express";
import axios from "axios";
import cors from "cors";
import { CognitoIdentityProviderClient,ListUsersCommand, AdminGetUserCommand, AdminListGroupsForUserCommand, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import 'dotenv/config';


const app = express();
app.use(express.json());


const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

const USER_POOL_ID = process.env.USER_POOL_ID;

app.use(cors({
  origin: 'eks-fe.learnc.online',   // restrict later
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const OPA_URL = "http://localhost:8181/v1/data/httpapi/authz";


app.get("/", (req, res) => {
  res.status(200).json({
    message : "healthCheck : HealthyApp :)"
  })
});

// Middleware → call OPA
async function authorize(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    // Decode JWT (basic decode, NOT verify)
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );

    const roles =
      payload.roles || payload["cognito:groups"] || [];

    const user_name = payload.user_name ;

    const input = {
      input: {
        user : user_name,
        method: req.method,
        path: req.path,
        roles: roles
      }
    };

    const response = await axios.post(OPA_URL, input);

    if (response.data.result.allow) {
      return next();
    } else {
      return res.status(403).json({ message: "Forbidden 🚫" });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Auth error" });
  }
}

// Routes
app.get("/admin", authorize, (req, res) => {
  res.json({
    message: "Here is your cat 🐱",
    imageUrl : "https://imgs.search.brave.com/5n61h6R4GsGhtbNLilHe_bG9ahpe1cVNgrZFRL44D9g/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5nZXR0eWltYWdl/cy5jb20vaWQvMjI0/NTA0NTA4Ny9waG90/by9hLWN1dGUtYnJp/dGlzaC1zaG9ydGhh/aXItY2F0LXdlYXJp/bmctc3VuZ2xhc3Nl/cy1yZWxheGVzLW9u/LWEtc29mdC1ibGFu/a2V0LW5leHQtdG8t/YS1zbWFydHBob25l/LmpwZz9zPTYxMng2/MTImdz0wJms9MjAm/Yz02aXRUUUFoTW5w/blY4cksxdklJUFdL/bHB1UVdRSGNSTXNO/UGRXbXNoNHprPQ"
  });
});

app.get("/dev", authorize, (req, res) => {
  res.json({  
    message: "Here is your cat 🐱",
    imageUrl : "https://imgs.search.brave.com/rG7i0zy61qM6jg8GrAv6trSb11bcGoAITrsYIW79cFA/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wNTIv/MjkyLzE0Mi9zbWFs/bC9hLWNhdC13aXRo/LWEtc2FkLWZhY2Ut/ZnJlZS1waG90by5q/cGc"
  }); 
});

app.get("/tester", authorize, (req, res) => {
  res.json({ 
    message: "Here is your cat 🐱",
    imageUrl : "https://imgs.search.brave.com/J3PenefmqXiEcj2dcP7qcwHm_uZXmjI2YWBZE3nO8oQ/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pLmV0/c3lzdGF0aWMuY29t/LzI4MDEwNDYxL2Mv/NDMzLzM0NC8wLzYy/L2lsLzc2NjdlNy8z/Nzc1NTAwNjAxL2ls/XzM0MHgyNzAuMzc3/NTUwMDYwMV9ycDF2/LmpwZw"
 });
});

app.get("/viewer", authorize, (req, res) => {
  res.json({ 
    message: "Here is your cat 🐱",
    imageUrl : "https://imgs.search.brave.com/ehv2Z81I_MQIaq_byJwjCWP2txTIno_jH8T5aYZdLqc/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS50ZW5vci5jb20v/YUZwRUJ6WjlZSDBB/QUFBTS9jYXQtbWVt/ZS1jYXQtY3J5aW5n/LW1lbWUuZ2lm.gif"
 });
});


// ─── USER DISCOVERY ─────────────────────────────────────────────────────────
// POST /userManage/discover
// Body: { email: "user@example.com" }
// Auth: Bearer token (must be superAdmin — OPA checks this)

// app.post("/userManage/discover", authorize, async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ message: "email is required" });
//   }

//   try {
//     // 1. Fetch user from Cognito by email
//     const getUserCmd = new AdminGetUserCommand({
//       UserPoolId: USER_POOL_ID,
//       Username: email,          // Cognito accepts email as username if email is the alias
//     });

//     const userResult = await cognitoClient.send(getUserCmd);

//     // Extract sub from user attributes
//     const sub = userResult.UserAttributes.find(attr => attr.Name === "sub")?.Value;
//     const userEmail = userResult.UserAttributes.find(attr => attr.Name === "email")?.Value;

//     // 2. Fetch current groups for this user
//     const listGroupsCmd = new AdminListGroupsForUserCommand({
//       UserPoolId: USER_POOL_ID,
//       Username: email,
//     });

//     const groupsResult = await cognitoClient.send(listGroupsCmd);
//     const currentGroups = groupsResult.Groups.map(g => g.GroupName);

//     return res.status(200).json({
//       username: userResult.Username,
//       email: userEmail,
//       sub,
//       currentGroups,
//     });

//   } catch (err) {
//     if (err.name === "UserNotFoundException") {
//       return res.status(404).json({ message: "User not found in pool", err});
//     }
//     console.error("Discover error:", err);
//     return res.status(500).json({ message: "Failed to fetch user" });
//   }
// });


app.post("/userManage/discover", authorize, async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "email is required" });

  try {
    // Search by email attribute — works for ALL user types
    const listCmd = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${email}"`,   // Cognito filter syntax
      Limit: 1,
    });

    const listResult = await cognitoClient.send(listCmd);

    if (!listResult.Users || listResult.Users.length === 0) {
      return res.status(404).json({ message: "User not found in pool" });
    }

    const user = listResult.Users[0];
    const sub = user.Attributes.find(a => a.Name === "sub")?.Value;
    const userEmail = user.Attributes.find(a => a.Name === "email")?.Value;

    // Now use the actual Username (e.g. "google_XXXX") for group lookup
    const listGroupsCmd = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: user.Username,    // ← actual username, not email
    });

    const groupsResult = await cognitoClient.send(listGroupsCmd);
    const currentGroups = groupsResult.Groups.map(g => g.GroupName);

    return res.status(200).json({
      username: user.Username,    // frontend must send this back in /apply
      email: userEmail,
      sub,
      currentGroups,
    });

  } catch (err) {
    console.error("Discover error:", err);
    return res.status(500).json({ message: "Failed to fetch user" });
  }
});


// ─── APPLY GROUP CHANGES ────────────────────────────────────────────────────
// POST /userManage/apply
// Body: { username: "user@example.com", newGroups: ["admin", "tester"] }
// Auth: Bearer token (must be superAdmin — OPA checks this)
// Behavior: REPLACES groups — removes from any group not in newGroups, adds to all in newGroups

// app.post("/userManage/apply", authorize, async (req, res) => {
//   const { username, newGroups } = req.body;

//   if (!username || !Array.isArray(newGroups)) {
//     return res.status(400).json({ message: "username and newGroups[] are required" });
//   }

//   // Valid groups in your pool — acts as a safeguard against arbitrary group injection
//   const VALID_GROUPS = ["admin", "developer", "tester", "viewer", "superAdmin"];
//   const sanitizedNewGroups = newGroups.filter(g => VALID_GROUPS.includes(g));

//   try {
//     // 1. Get current groups for user
//     const listGroupsCmd = new AdminListGroupsForUserCommand({
//       UserPoolId: USER_POOL_ID,
//       Username: username,
//     });
//     const groupsResult = await cognitoClient.send(listGroupsCmd);
//     const currentGroups = groupsResult.Groups.map(g => g.GroupName);

//     // 2. Compute diff
//     const groupsToAdd = sanitizedNewGroups.filter(g => !currentGroups.includes(g));
//     const groupsToRemove = currentGroups.filter(g => !sanitizedNewGroups.includes(g));

//     // 3. Add to new groups
//     await Promise.all(
//       groupsToAdd.map(group =>
//         cognitoClient.send(new AdminAddUserToGroupCommand({
//           UserPoolId: USER_POOL_ID,
//           Username: username,
//           GroupName: group,
//         }))
//       )
//     );

//     // 4. Remove from old groups
//     await Promise.all(
//       groupsToRemove.map(group =>
//         cognitoClient.send(new AdminRemoveUserFromGroupCommand({
//           UserPoolId: USER_POOL_ID,
//           Username: username,
//           GroupName: group,
//         }))
//       )
//     );

//     return res.status(200).json({
//       message: "Groups updated successfully",
//       username,
//       added: groupsToAdd,
//       removed: groupsToRemove,
//       currentGroups: sanitizedNewGroups,
//     });

//   } catch (err) {
//     if (err.name === "UserNotFoundException") {
//       return res.status(404).json({ message: "User not found in pool", err });
//     }
//     console.error("Apply error:", err);
//     return res.status(500).json({ message: "Failed to update groups" });
//   }
// });


app.post("/userManage/apply", authorize, async (req, res) => {
  console.log("[/userManage/apply] Request received");
  console.log("[/userManage/apply] Request body:", JSON.stringify(req.body, null, 2));

  const { username, newGroups } = req.body;

  if (!username || !Array.isArray(newGroups)) {
    console.warn("[/userManage/apply] Validation failed — missing username or newGroups", { username, newGroups });
    return res.status(400).json({ message: "username and newGroups[] are required" });
  }

  const VALID_GROUPS = ["admin", "developer", "tester", "viewer", "superAdmin"];
  const sanitizedNewGroups = newGroups.filter(g => VALID_GROUPS.includes(g));

  console.log("[/userManage/apply] Requested groups:", newGroups);
  console.log("[/userManage/apply] Sanitized groups (after allowlist filter):", sanitizedNewGroups);

  const rejectedGroups = newGroups.filter(g => !VALID_GROUPS.includes(g));
  if (rejectedGroups.length > 0) {
    console.warn("[/userManage/apply] These groups were rejected (not in allowlist):", rejectedGroups);
  }

  try {
    // 1. Get current groups
    console.log(`[/userManage/apply] Fetching current groups for username: "${username}"`);
    const listGroupsCmd = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });
    const groupsResult = await cognitoClient.send(listGroupsCmd);
    const currentGroups = groupsResult.Groups.map(g => g.GroupName);
    console.log("[/userManage/apply] Current groups in Cognito:", currentGroups);

    // 2. Compute diff
    const groupsToAdd = sanitizedNewGroups.filter(g => !currentGroups.includes(g));
    const groupsToRemove = currentGroups.filter(g => !sanitizedNewGroups.includes(g));
    console.log("[/userManage/apply] Diff — groups to ADD:", groupsToAdd);
    console.log("[/userManage/apply] Diff — groups to REMOVE:", groupsToRemove);

    if (groupsToAdd.length === 0 && groupsToRemove.length === 0) {
      console.log("[/userManage/apply] No changes needed — user already has exactly these groups");
    }

    // 3. Add to new groups
    if (groupsToAdd.length > 0) {
      console.log("[/userManage/apply] Adding user to groups...");
      await Promise.all(
        groupsToAdd.map(async (group) => {
          console.log(`[/userManage/apply]   → Adding to group: "${group}"`);
          await cognitoClient.send(new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: group,
          }));
          console.log(`[/userManage/apply]   ✓ Successfully added to "${group}"`);
        })
      );
    }

    // 4. Remove from old groups
    if (groupsToRemove.length > 0) {
      console.log("[/userManage/apply] Removing user from groups...");
      await Promise.all(
        groupsToRemove.map(async (group) => {
          console.log(`[/userManage/apply]   → Removing from group: "${group}"`);
          await cognitoClient.send(new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: group,
          }));
          console.log(`[/userManage/apply]   ✓ Successfully removed from "${group}"`);
        })
      );
    }

    console.log("[/userManage/apply] ✅ All group operations completed successfully");
    console.log("[/userManage/apply] Final state — username:", username, "| groups:", sanitizedNewGroups);

    return res.status(200).json({
      message: "Groups updated successfully",
      username,
      added: groupsToAdd,
      removed: groupsToRemove,
      currentGroups: sanitizedNewGroups,
    });

  } catch (err) {
    if (err.name === "UserNotFoundException") {
      console.error(`[/userManage/apply] ❌ UserNotFoundException — username "${username}" not found in pool`);
      return res.status(404).json({ message: "User not found in pool", err });
    }
    console.error("[/userManage/apply] ❌ Unexpected error:", err.name, err.message);
    console.error("[/userManage/apply] Full error object:", JSON.stringify(err, null, 2));
    return res.status(500).json({ message: "Failed to update groups" });
  }
});


app.listen(3000, () => {
  console.log("Backend running on port 3000");
});