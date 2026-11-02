# ChatGPT connection

Run `npm start` with Node.js 22 or later, then open `http://localhost:8000`. Choose **Connect ChatGPT** below the welcome actions or in the graph header. Connection settings let you sign in, review access to your ChatGPT plan, select an account-provided model, reconnect, manage usage, and disconnect. Complete sign-in in the separate tab and return to Nexlit. The label becomes **ChatGPT connected** only when the local session grants plan access.

Choosing **Search papers** in the search dialog requires a ChatGPT connection. If disconnected, Nexlit opens sign-in in a separate tab and waits for the connection and the plan-use notice acknowledgement before continuing the search automatically. Canceling or closing connection settings leaves the query in place without searching. An existing connected session proceeds directly. Bibliographic search still uses OpenAlex; connecting does not yet make search or summaries AI-generated.

The local service reuses the existing Sign in with ChatGPT implementation: loopback callback, PKCE, state, nonce and signed identity validation. Credentials are encrypted in `.local/`, outside the served `dist/` folder, with owner-only permissions. That directory and credential files are ignored by Git. Tokens are never sent to the browser or included in library exports. The local key and credential file must stay together; encryption does not protect against someone who can read both.

Disconnect clears the local credentials and attempts remote revocation. If revocation cannot be confirmed, the settings explain how to disconnect Nexlit in ChatGPT too. Keep the same app address and port to preserve access to browser-saved libraries. A plain static server still supports library actions, but the connection settings explain that the local server is needed for sign-in.

For a separate local server, set `PORT` and optionally `NEXLIT_DATA_DIR`; keep private data outside `dist/`. The service binds only to loopback and is intended for one user on their own computer. Real sign-in depends on account eligibility and OpenAI availability. Automated checks use mock services and signed synthetic credentials.

Official documentation: [registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in).
