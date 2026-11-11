<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { renameProject } from "../api/projectsApi";
  import type { Member, Project } from "../api/types";
  import { errorMessage } from "../shared/errors";
  import { formatDate } from "../shared/format";
  import CopyField from "../shared/ui/CopyField.svelte";
  import { toast } from "../shared/toast.svelte";

  let {
    project,
    members,
    isAdmin,
    onchange,
  }: { project: Project; members: Member[]; isAdmin: boolean; onchange: (project: Project) => void } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(project.name);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const owner = $derived(members.find((m) => m.userId === project.ownerId));
  const changed = $derived(name.trim() !== project.name && name.trim().length > 0);

  async function onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!changed || busy) return;
    busy = true;
    error = null;
    try {
      onchange(await renameProject(project.id, name.trim()));
      toast(t("ps.nameUpdated"), { kind: "success" });
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<header class="section-head">
  <h2>{t("ps.general")}</h2>
  <p>{t("ps.generalText")}</p>
</header>

<form class="panel" onsubmit={onSubmit}>
  <div class="field">
    <label for="project-name">{t("dash.projectName")}</label>
    <input id="project-name" class="input" bind:value={name} maxlength="100" readonly={!isAdmin} aria-describedby={error ? "name-err" : undefined} />
    {#if error}<span class="field-error" id="name-err" role="alert">{error}</span>{/if}
  </div>
  {#if isAdmin}
    <div class="actions">
      <button type="submit" class="btn btn-primary" disabled={!changed || busy}>
        {#if busy}<span class="spinner"></span>{/if} {t("common.save")}
      </button>
      {#if changed}<button type="button" class="btn btn-ghost" onclick={() => ((name = project.name), (error = null))}>{t("common.cancel")}</button>{/if}
    </div>
  {/if}
</form>

<div class="panel">
  <dl>
    <div><dt>{t("dash.owner")}</dt><dd class="selectable">{owner?.user.name ?? "—"}</dd></div>
    <div><dt>{t("ps.createdOn")}</dt><dd>{formatDate(project.createdAt)}</dd></div>
  </dl>
  <div class="field">
    <span class="label">{t("ps.projectId")}</span>
    <CopyField value={project.id} label={t("ps.projectId")} />
    <span class="hint">{t("ps.projectIdHint")}</span>
  </div>
</div>

<style>
  .actions {
    display: flex;
    gap: 8px;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }
  dt {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-faint);
  }
  dd {
    margin: 2px 0 0;
    font-weight: 550;
  }
</style>
