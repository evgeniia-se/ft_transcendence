<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { deleteProject, transferOwnership } from "../api/projectsApi";
  import type { Member, Project } from "../api/types";
  import { confirmDialog } from "../shared/confirm.svelte";
  import { errorMessage } from "../shared/errors";
  import { toast } from "../shared/toast.svelte";
  import Icon from "../shared/ui/Icon.svelte";

  let {
    project,
    members,
    isOwner,
    userId,
    onchange,
  }: { project: Project; members: Member[]; isOwner: boolean; userId: string | null; onchange: (project: Project) => void } = $props();

  // the new owner must already be a member (they become admin)
  const candidates = $derived(members.filter((m) => m.userId !== userId));
  let newOwner = $state("");
  let busy = $state(false);

  async function onTransfer(): Promise<void> {
    const target = members.find((m) => m.userId === newOwner);
    if (!target) return;
    const ok = await confirmDialog({
      title: t("danger.transferTitle", { name: target.user.name }),
      message: t("danger.transferText"),
      confirmLabel: t("danger.transfer"),
      danger: true,
    });
    if (!ok) return;
    busy = true;
    try {
      onchange(await transferOwnership(project.id, target.userId));
      newOwner = "";
      toast(t("danger.transferred", { name: target.user.name }), { kind: "success" });
    } catch (err) {
      toast(errorMessage(err), { kind: "error" });
    } finally {
      busy = false;
    }
  }

  async function onDelete(): Promise<void> {
    const ok = await confirmDialog({
      title: t("danger.deleteTitle"),
      message: t("danger.deleteText"),
      confirmLabel: t("danger.deleteForever"),
      danger: true,
      requireText: project.name,
    });
    if (!ok) return;
    busy = true;
    try {
      await deleteProject(project.id);
      window.location.href = "/app";
    } catch (err) {
      busy = false;
      toast(errorMessage(err), { kind: "error" });
    }
  }
</script>

<header class="section-head">
  <h2>{t("ps.danger")}</h2>
  <p>{t("danger.intro")}</p>
</header>

{#if !isOwner}
  <div class="panel">
    <p class="muted"><Icon name="lock" size={16} /> {t("danger.ownerOnly")}</p>
  </div>
{:else}
  <div class="panel panel-danger">
    <h3>{t("danger.transferOwnership")}</h3>
    <p class="muted">{t("danger.transferHint")}</p>
    {#if candidates.length === 0}
      <p class="hint">{t("danger.inviteFirst")}</p>
    {:else}
      <div class="inline">
        <select class="input" bind:value={newOwner} aria-label={t("settings.newOwner")}>
          <option value="">{t("danger.chooseMember")}</option>
          {#each candidates as member (member.userId)}<option value={member.userId}>{member.user.name} — {member.user.email}</option>{/each}
        </select>
        <button type="button" class="btn btn-danger" disabled={!newOwner || busy} onclick={onTransfer}>{t("danger.transfer")}</button>
      </div>
    {/if}
  </div>

  <div class="panel panel-danger">
    <h3>{t("danger.deleteProject")}</h3>
    <p class="muted">{t("danger.deleteHint", { name: project.name })}</p>
    <div><button type="button" class="btn btn-danger" disabled={busy} onclick={onDelete}><Icon name="trash" size={16} /> {t("danger.deleteProject")}</button></div>
  </div>
{/if}

<style>
  .muted {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-soft);
  }
  .inline {
    display: flex;
    gap: 10px;
  }
  .inline select {
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 560px) {
    .inline {
      flex-direction: column;
    }
  }
</style>
