import { useState } from "react";

export function PassphrasePrompt() {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-base-100 flex items-center justify-center">
      <div className="card bg-base-200 border border-base-300 w-full max-w-[340px] shadow-xl">
        <div className="card-body p-10">
          <h1 className="text-[15px] font-bold tracking-[0.12em] uppercase text-base-content/60 mb-7">
            Lattice
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <fieldset className="fieldset">
              <legend className="fieldset-legend text-[11px] uppercase tracking-[0.1em] text-base-content/40">
                Passphrase
              </legend>
              <input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={function (e) { setPassphrase(e.target.value); }}
                autoFocus
                autoComplete="current-password"
                disabled={loading}
                className="input input-bordered w-full bg-base-100 text-base-content text-[14px]"
              />
            </fieldset>
            <button
              type="submit"
              disabled={loading}
              className={"btn btn-primary w-full mt-1 " + (loading ? "cursor-not-allowed" : "")}
            >
              {loading ? "Authenticating..." : "Authenticate"}
            </button>
            {error && (
              <p className="text-[12px] text-error text-center">{error}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
