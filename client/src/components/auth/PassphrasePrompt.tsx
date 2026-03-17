import { useState } from "react";

export function PassphrasePrompt() {
  var [passphrase, setPassphrase] = useState("");
  var [error, setError] = useState("");
  var [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    fetch("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    })
      .then(function (res) {
        if (res.ok) {
          window.location.reload();
        } else {
          setError("Invalid passphrase.");
          setLoading(false);
        }
      })
      .catch(function () {
        setError("Connection error.");
        setLoading(false);
      });
  }

  return (
    <div className="passphrase-prompt">
      <div className="passphrase-card">
        <h1>Lattice</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="passphrase">Passphrase</label>
          <input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={function (e) {
              setPassphrase(e.target.value);
            }}
            autoFocus
            autoComplete="current-password"
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Authenticating..." : "Authenticate"}
          </button>
          {error && <p className="passphrase-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
