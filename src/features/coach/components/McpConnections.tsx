import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "@/features/coach/services/aiApi";
import { getApiBaseUrl } from "@/services/api/config";
export function McpConnections({ canCreate = true }: { canCreate?: boolean }) {
  const client = useQueryClient();
  const tokens = useQuery({ queryKey: ["coach", "mcp-tokens"], queryFn: listMcpTokens, retry: false });
  const [name, setName] = useState("");
  const [propose, setPropose] = useState(false);
  const [secret, setSecret] = useState("");
  const create = useMutation({ mutationFn: () => createMcpToken(name, propose), onSuccess: result => { setSecret(result.secret || ""); setName(""); void client.invalidateQueries({ queryKey: ["coach", "mcp-tokens"] }); } });
  const revoke = useMutation({ mutationFn: revokeMcpToken, onSuccess: () => { setSecret(""); void client.invalidateQueries({ queryKey: ["coach", "mcp-tokens"] }); } });
  return <details className="coach-connections"><summary>External AI connections (MCP pilot)</summary>
    <p>Connect a client that supports Streamable HTTP and a manually configured bearer token. Tokens expire after 30 days.</p>
    <label>MCP endpoint<input readOnly value={new URL(`${getApiBaseUrl().replace(/\/$/, "")}/mcp`, window.location.origin).href} /></label>
    <form onSubmit={event => { event.preventDefault(); if (canCreate) create.mutate(); }}>
      <label>Connection name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
      <label><input type="checkbox" checked={propose} onChange={event => setPropose(event.target.checked)} /> Allow creating workout drafts</label>
      <button className="secondary-button" disabled={!canCreate || create.isPending || !name.trim()}>Create token</button>
    </form>
    {secret && <div role="status"><p>Copy this token now. It is shown only once.</p><input aria-label="New MCP token" readOnly value={secret} /><button className="secondary-button" onClick={() => setSecret("")}>Hide token</button></div>}
    {(create.error || revoke.error || tokens.error) && <p role="alert">{(create.error || revoke.error || tokens.error)?.message}</p>}
    <ul>{tokens.data?.map(token => <li key={token.id}>{token.name} · {token.scopes?.join(", ")} · expires {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : ""} <button className="secondary-button" disabled={revoke.isPending || !token.id} onClick={() => token.id && revoke.mutate(token.id)}>Revoke</button></li>)}</ul>
  </details>;
}
