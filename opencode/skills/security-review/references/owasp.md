# Secure code review checklist

Organised by the OWASP Top 10 categories. Work it against the attack surface
you mapped, not as a context-free sweep.

## A01 Broken access control

The most common serious flaw in real applications. Spend the most time here.

- [ ] Every endpoint checks authorisation, not merely authentication
- [ ] **Object-level** authorisation: changing an ID in the request does not
      return another user record (IDOR)
- [ ] Authorisation enforced server-side, never by hiding UI elements
- [ ] Tenant isolation enforced in the query itself, not by a filter that a
      later code path can bypass
- [ ] No path traversal in file operations - canonicalise, then check
- [ ] CORS not permissive; no reflected origin with credentials
- [ ] Admin routes protected by a check, not by obscurity
- [ ] Deny by default: a new endpoint is unreachable until explicitly allowed

## A02 Cryptographic failures

- [ ] TLS enforced end to end, 1.2 minimum, certificate validation not disabled
- [ ] Passwords hashed with argon2, scrypt or bcrypt - never a fast hash
- [ ] No MD5 or SHA-1 for anything security-relevant
- [ ] Randomness from a CSPRNG, not `Random` or `Math.random`
- [ ] Tokens have adequate entropy and an expiry
- [ ] No custom cryptography
- [ ] Sensitive fields encrypted at rest where required
- [ ] Keys are not in source, and rotation is possible

## A03 Injection

- [ ] SQL: parameterised queries or an ORM used correctly. Concatenated
      identifiers, ORDER BY and raw fragments are the usual escapes
- [ ] NoSQL: operator injection through object-valued query parameters
- [ ] OS commands: no shell interpolation of user input; pass argument
      arrays, never a constructed command string
- [ ] LDAP, XPath, template engines: escaped for their own grammar
- [ ] Output encoding correct for the context - HTML body, attribute, JS,
      URL and CSS each need different encoding
- [ ] No `dangerouslySetInnerHTML`, `v-html`, `innerHTML` or `MarkupString`
      on untrusted content
- [ ] Deserialization of untrusted data restricted to known types
- [ ] Header, log and email-header injection through unvalidated newlines

## A04 Insecure design

- [ ] Rate limiting and anti-automation on authentication, password reset,
      and anything expensive
- [ ] Business logic cannot be driven to a bad state: negative quantities,
      re-used one-time tokens, replayed webhooks, race conditions on balance
- [ ] Workflow steps cannot be skipped or reordered
- [ ] Limits on everything unbounded: page size, upload size, recursion

## A05 Security misconfiguration

- [ ] Debug mode, verbose errors and stack traces off in production
- [ ] Default credentials changed; sample and admin apps removed
- [ ] Security headers set: HSTS, `X-Content-Type-Options`, a real CSP,
      `Referrer-Policy`, `X-Frame-Options` or CSP `frame-ancestors`
- [ ] Cookies `Secure`, `HttpOnly`, and `SameSite` set deliberately
- [ ] Directory listing disabled; no `.git`, `.env` or backup files served
- [ ] Unused features, ports and endpoints disabled

## A06 Vulnerable and outdated components

- [ ] Dependencies pinned, with a lockfile committed
- [ ] Audit run against the **actual lockfile version** - never assert a CVE
      without checking the resolved version
- [ ] No unmaintained or abandoned direct dependencies
- [ ] Transitive dependencies reviewed for the same
- [ ] Base images pinned by digest and rebuilt regularly

## A07 Identification and authentication failures

- [ ] No user enumeration through differing responses, status codes or timing
- [ ] Brute-force protection: lockout or progressive delay
- [ ] Session ID regenerated on privilege change and on login
- [ ] Logout invalidates server-side, not only client-side
- [ ] Session and token expiry actually enforced on the server
- [ ] MFA available for privileged accounts
- [ ] Password reset tokens single-use, short-lived, and unguessable
- [ ] JWTs: algorithm pinned (`none` rejected), signature verified,
      `exp`/`aud`/`iss` all checked

## A08 Software and data integrity failures

- [ ] CI/CD cannot be modified by an unreviewed commit
- [ ] Build artifacts signed or checksummed
- [ ] No unpinned third-party script in a page that handles credentials
- [ ] Auto-update mechanisms verify signatures
- [ ] Webhook payloads signature-verified before being acted on

## A09 Logging and monitoring failures

- [ ] Authentication, authorisation and privilege changes are logged
- [ ] Logs include actor, action, target, timestamp and correlation ID
- [ ] **No secrets, tokens, card numbers or personal data in logs**
- [ ] Logs shipped off-host where an attacker cannot edit them
- [ ] Alerting exists for repeated authorisation failures

## A10 Server-side request forgery

- [ ] User-supplied URLs are allowlisted by host, not merely filtered
- [ ] Requests to link-local and private ranges blocked - including
      `169.254.169.254`, the cloud metadata endpoint
- [ ] Redirects not followed blindly to a new host
- [ ] DNS rebinding considered where the check and the fetch are separate

---

## Language-specific traps

**C# / .NET** - `FromSqlRaw` and `ExecuteSqlRaw` with interpolation;
`BinaryFormatter`; `MarkupString` in Blazor; missing `[Authorize]`;
over-posting through model binding, mitigated with an explicit DTO;
`ValidateAntiForgeryToken` absent on state-changing endpoints.

**Python** - `subprocess` with `shell=True`; `pickle` or `yaml.load` on
untrusted data; `eval` and `exec`; f-strings inside SQL; `tarfile.extractall`
path traversal; `assert` for security checks, which vanishes under `-O`.

**PowerShell** - `Invoke-Expression` on any external string; unconstrained
language mode; credentials in plain text or in transcript logs;
`ConvertTo-SecureString -AsPlainText -Force` in committed scripts.

**Web front end** - `innerHTML` on untrusted input; `postMessage` handlers
without an origin check; tokens in `localStorage` where XSS can read them;
`target="_blank"` without `rel="noopener"`.

## Before reporting

Trace the full path from source to sink. If you have not read every frame in
between, mark the finding `needs verification` rather than `confirmed`. A
confident false positive costs the team more than an honest question.
