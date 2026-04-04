package httpapi.authz

default allow = false

# Admin → full access
allow if {
  "admin" in input.roles
}

# superAdmin → full access to everything including userManage
allow if {
  "superAdmin" in input.roles
}


# Developer → /dev
allow if {
  "developer" in input.roles
  input.path == "/dev"
}

# Tester → /tester
allow if {
  "tester" in input.roles
  input.path == "/tester"
}

# Viewer → /viewer
allow if {
  "viewer" in input.roles
  input.path == "/viewer"
}

decision := {
  "user": input.user_name,
  "roles": input.roles,
  "path": input.path,
  "method": input.method,
  "allow": allow
}