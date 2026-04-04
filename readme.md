Cognito-OPA architecture

run opa server : opa run --server opa/policy.rego


So, in a organisation is already setup, let's assume a normal user sign in done is of the viewers only for the app and only workspace users are allowed to take roles of admin, developer, tester .

Now, by workspace users I mean, as in Microsoft entra ID connect : I can create users in my driector


1. how can I ensure emails are verified also for external provider users
2. right now the flow is : forntend -> API gateway [it has authorizers for validating JWT tokens] -> calls OPA lambda [which verifying users claims ] -> it then calls nodeBackend => This is incorrect flow 
 -> it should be api gateway calls -> backendLambda which calls OPA always and then requets is either allowed or denied  [nodebackend is exposed to other service without OPA checks in above flow]
3. Finally deploy on EKS