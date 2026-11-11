<script lang="ts">
  import { t, type MessageKey } from "../shared/i18n.svelte";
  import { onMount } from "svelte";
  import { createInvite, listInvites, revokeInvite } from "../api/projectsApi";
  import type { Invite, Project, Role } from "../api/types";
  import { confirmDialog } from "../shared/confirm.svelte";
  import { errorMessage } from "../shared/errors";
  import { roleHint, roleLabel, formatDate } from "../shared/format";
  import { toast } from "../shared/toast.svelte";
  import CopyField from "../shared/ui/CopyField.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  let { project, isAdmin }: { project: Project; isAdmin: boolean } = $props();

  const EXPIRY: { label: MessageKey; days: number | null }[] = [
    { label: "inv.never", days: null },
    { label: "inv.day1", days: 1 },
    { label: "inv.days7", days: 7 },
    { label: "inv.days30", days: 30 },
  ];

  let invites = $state<Invite[] | null>(null);
  let loadFailed = $state(false);

  let role = $state<Role>("member");
  let expiryDays = $state<number | null>(7);
  // a type="number" input binds a number (null when empty), never a string
  let maxUses = $state<number | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  // the token only exists in the creation response: keep the link visible
  let fresh = $state<{ url: string; role: Role } | null>(null);

  onMount(() => {
    if (isAdmin) void load();
  });

  async function load(): Promise<void> {
    loadFailed = false;
    try {
      invites = await listInvites(project.id);
    } catch {
      loadFailed = true;
    }
  }

  async function onCreate(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = null;
    const uses = maxUses === null ? undefined : maxUses;
    if (uses !== undefined && (!Number.isInteger(uses) || uses < 1 || uses > 1000)) {
      error = t("inv.usesInvalid");
      return;
    }
    busy = true;
    try {
      const { token } = await createInvite(project.id, {
        role,
        maxUses: uses,
        expiresAt: expiryDays ? new Date(Date.now() + expiryDays * 86_400_000).toISOString() : undefined,
      });
      fresh = { url: `${location.origin}/invite/${token}`, role };
      maxUses = null;
      await load();
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }

  async function revoke(invite: Invite): Promise<void> {
    const ok = await confirmDialog({
      title: t("inv.revokeTitle"),
      message: t("inv.revokeText"),
      confirmLabel: t("common.revoke"),
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeInvite(project.id, invite.id);
      toast(t("inv.revoked"));
      await load();
    } catch (err) {
      toast(errorMessage(err), { kind: "error" });
      await load();
    }
  }

  function status(invite: Invite): { label: string; tone: "ok" | "off" } {
    if (invite.revokedAt) return { label: t("inv.stRevoked"), tone: "off" };
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) return { label: t("inv.stExpired"), tone: "off" };
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return { label: t("inv.stExhausted"), tone: "off" };
    return { label: t("inv.stActive"), tone: "ok" };
  }
</script>

<header class="section-head">
  <h2>{t("ps.invites")}</h2>
  <p>{t("inv.intro")}</p>
</header>

{#if !isAdmin}
  <div class="panel"><p class="muted">{t("inv.adminOnly")}</p></div>
{:else}
  {#if fresh}
    <div class="panel fresh" role="status">
      <div class="row-between">
        <strong><Icon name="check" size={16} /> {t("inv.created", { role: roleLabel(fresh.role) })}</strong>
        <button type="button" class="icon-btn" aria-label={t("common.close")} onclick={() => (fresh = null)}><Icon name="x" size={16} /></button>
      </div>
      <CopyField value={fresh.url} label={t("inv.link")} />
      <p class="hint warn">{t("inv.copyNow")}</p>
    </div>
  {/if}

  <form class="panel" onsubmit={onCreate}>
    <h3>{t("inv.create")}</h3>
    <div class="grid">
      <div class="field">
        <label for="inv-role">{t("inv.role")}</label>
        <select id="inv-role" class="input" bind:value={role}>
          {#each ["admin", "member", "viewer"] as r (r)}<option value={r}>{roleLabel(r as Role)}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="inv-exp">{t("inv.expires")}</label>
        <select id="inv-exp" class="input" bind:value={expiryDays}>
          {#each EXPIRY as option (option.label)}<option value={option.days}>{t(option.label)}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="inv-uses">{t("inv.maxUses")}</label>
        <input id="inv-uses" class="input" type="number" min="1" max="1000" step="1" inputmode="numeric" placeholder={t("inv.unlimited")} bind:value={maxUses} />
      </div>
    </div>
    <span class="hint">{roleHint(role)}.</span>
    {#if error}<span class="field-error" role="alert">{error}</span>{/if}
    <div><button type="submit" class="btn btn-primary" disabled={busy}>{#if busy}<span class="spinner"></span>{:else}<Icon name="link" size={16} />{/if} {t("inv.createLink")}</button></div>
  </form>

  <div class="panel list">
    <h3>{t("inv.existing")}</h3>
    {#if loadFailed}
      <p class="muted">{t("inv.loadFailed")} <button type="button" class="linklike" onclick={load}>{t("common.retry")}</button></p>
    {:else if invites === null}
      <div class="skeleton line"></div>
    {:else if invites.length === 0}
      <p class="muted">{t("inv.empty")}</p>
    {:else}
      {#each invites as invite (invite.id)}
        {@const st = status(invite)}
        <div class="row" class:off={st.tone === "off"}>
          <span class="chip" class:chip-accent={st.tone === "ok"}>{st.label}</span>
          <div class="info">
            <div><strong>{roleLabel(invite.role)}</strong> · {t("inv.createdOn", { date: formatDate(invite.createdAt) })}</div>
            <div class="sub">
              {invite.useCount}{invite.maxUses !== null ? ` / ${invite.maxUses}` : ""} {invite.useCount > 1 ? t("inv.uses") : t("inv.use")}
              · {invite.expiresAt ? t("inv.expiresOn", { date: formatDate(invite.expiresAt) }) : t("inv.noExpiry")}
            </div>
          </div>
          {#if st.tone === "ok"}
            <button type="button" class="btn btn-ghost btn-sm" onclick={() => revoke(invite)}>{t("common.revoke")}</button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 14px;
  }
  .fresh {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface));
  }
  .fresh strong {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--accent-strong);
  }
  .hint.warn {
    color: var(--warn);
  }
  .muted {
    color: var(--text-soft);
  }
  .list {
    gap: 4px;
  }
  .list h3 {
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .row.off .info {
    opacity: 0.6;
  }
  .chip {
    min-width: 64px;
    justify-content: center;
  }
  .info {
    flex: 1;
    min-width: 0;
    font-size: 0.92rem;
  }
  .sub {
    font-size: 0.8rem;
    color: var(--text-faint);
  }
  .line {
    height: 48px;
  }
  .linklike {
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
    padding: 0;
  }
</style>
