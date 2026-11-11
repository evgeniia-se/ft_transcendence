<!-- Account settings: avatar (PUT/DELETE /api/users/me/avatar), display name (PATCH /api/users/me), password (PUT /api/users/me/password). The e-mail is the login identity and is read-only. -->
<script lang="ts">
  import { t } from "../shared/i18n.svelte";
  import { ApiError } from "../api/apiClient";
  import { AVATAR_TYPES, MAX_AVATAR_BYTES, changePassword, deleteAccount, removeAvatar, updateProfile, uploadAvatar } from "../api/accountApi";
  import { MAX_NAME_LENGTH, validateName, validateNewPassword } from "../auth/validation";
  import { listMembers, listMyProjects } from "../api/projectsApi";
  import type { Member, Project } from "../api/types";
  import { clearAuthSession, getStoredUser, logout, storeUser } from "../auth/authClient";
  import { confirmDialog } from "../shared/confirm.svelte";
  import { errorMessage } from "../shared/errors";
  import { ensureUser } from "../shared/session";
  import { toast } from "../shared/toast.svelte";
  import AppHeader from "../shared/ui/AppHeader.svelte";
  import Avatar from "../shared/ui/Avatar.svelte";
  import Icon from "../shared/ui/Icon.svelte";
  import ThemeSwitch from "../shared/ui/ThemeSwitch.svelte";
  import LangSwitch from "../shared/ui/LangSwitch.svelte";

  let user = $state(getStoredUser());
  let busy = $state(false);

  // display name form
  let name = $state(getStoredUser()?.name ?? "");
  let nameError = $state<string | null>(null);
  let savingName = $state(false);
  const nameChanged = $derived(name.trim() !== (user?.name ?? ""));

  async function onSaveName(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    nameError = validateName(name);
    if (nameError || !user || !nameChanged) return;
    savingName = true;
    try {
      const updated = await updateProfile(name.trim());
      user = { ...user, name: updated.name };
      storeUser(user);
      name = updated.name;
      toast(t("settings.nameUpdated"), { kind: "success" });
    } catch (err) {
      nameError = errorMessage(err);
    } finally {
      savingName = false;
    }
  }

  // avatar
  let fileInput: HTMLInputElement;
  let avatarError = $state<string | null>(null);
  let avatarBusy = $state(false);
  // picture chosen but not yet confirmed by the server, shown at once
  let preview = $state<string | null>(null);

  function clearPreview(): void {
    if (preview) URL.revokeObjectURL(preview);
    preview = null;
  }

  async function onPickAvatar(): Promise<void> {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    avatarError = null;
    if (!file || !user) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      avatarError = t("settings.avatarType");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      avatarError = t("settings.avatarSize", { size: (file.size / 1024 / 1024).toFixed(1) });
      return;
    }
    clearPreview();
    preview = URL.createObjectURL(file);
    avatarBusy = true;
    try {
      const { avatar } = await uploadAvatar(file);
      user = { ...user, avatar };
      storeUser(user);
      toast(t("settings.avatarUpdated"), { kind: "success" });
    } catch (err) {
      avatarError = errorMessage(err);
    } finally {
      clearPreview();
      avatarBusy = false;
    }
  }

  async function onRemoveAvatar(): Promise<void> {
    if (!user) return;
    avatarBusy = true;
    avatarError = null;
    try {
      await removeAvatar();
      user = { ...user, avatar: null };
      storeUser(user);
      toast(t("settings.avatarRemoved"), { kind: "success" });
    } catch (err) {
      avatarError = errorMessage(err);
    } finally {
      avatarBusy = false;
    }
  }

  // password form
  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let passwordError = $state<string | null>(null);
  let savingPassword = $state(false);

  async function onSavePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    passwordError = null;
    if (!currentPassword) {
      passwordError = t("settings.currentRequired");
      return;
    }
    passwordError = validateNewPassword(newPassword);
    if (!passwordError && newPassword !== confirmPassword) passwordError = t("settings.mismatch");
    if (!passwordError && newPassword === currentPassword) passwordError = t("settings.sameAsCurrent");
    if (passwordError) return;
    savingPassword = true;
    try {
      await changePassword(currentPassword, newPassword);
      currentPassword = newPassword = confirmPassword = "";
      toast(t("settings.passwordChanged"), { kind: "success" });
    } catch (err) {
      passwordError = errorMessage(err);
    } finally {
      savingPassword = false;
    }
  }

  // step to hand over projects before deleting the account
  let dialog: HTMLDialogElement;
  let handover = $state<{ projects: Project[]; candidates: Member["user"][]; reason: "transfer" | "last_admin" } | null>(null);
  let transferTo = $state("");

  $effect(() => {
    void ensureUser().then((u) => {
      user = u;
      if (u && !nameChanged) name = u.name;
    });
  });

  $effect(() => {
    document.title = `${t("userMenu.settings")} — Transcendance`;
  });

  async function onLogout(): Promise<void> {
    await logout();
    window.location.href = "/login";
  }

  async function onDelete(): Promise<void> {
    if (!user) return;
    const ok = await confirmDialog({
      title: t("settings.deleteTitle"),
      message: t("settings.deleteText"),
      confirmLabel: t("settings.deleteAccount"),
      danger: true,
      requireText: user.email,
    });
    if (ok) await attemptDelete();
  }

  async function attemptDelete(target?: string): Promise<void> {
    if (!user) return;
    busy = true;
    try {
      await deleteAccount(user.id, target);
      clearAuthSession();
      window.location.href = "/";
    } catch (err) {
      busy = false;
      if (err instanceof ApiError && (err.code === "transfer_target_required" || err.code === "last_admin_of_membership")) {
        await openHandover(err);
      } else if (err instanceof ApiError && err.code === "transfer_target_not_a_member") {
        toast(t("settings.notMemberOfAll"), { kind: "error" });
      } else {
        toast(errorMessage(err), { kind: "error" });
      }
    }
  }

  // projects blocking the deletion, and the members of all of them who could take over
  async function openHandover(err: ApiError): Promise<void> {
    const ids = Array.isArray(err.payload.projectIds) ? (err.payload.projectIds as string[]) : [];
    try {
      const all = await listMyProjects();
      const projects = all.filter((p) => ids.includes(p.id));
      const memberLists = await Promise.all(projects.map((p) => listMembers(p.id)));
      const common = memberLists
        .map((list) => list.filter((m) => m.userId !== user?.id).map((m) => m.user))
        .reduce<Member["user"][]>((acc, list, i) => (i === 0 ? list : acc.filter((u) => list.some((x) => x.id === u.id))), []);
      transferTo = "";
      handover = { projects, candidates: common, reason: err.code === "last_admin_of_membership" ? "last_admin" : "transfer" };
      dialog.showModal();
    } catch (loadErr) {
      toast(errorMessage(loadErr), { kind: "error" });
    }
  }

  function closeHandover(): void {
    dialog.close();
    handover = null;
  }
</script>

<AppHeader />

<main>
  <h1>{t("userMenu.settings")}</h1>

  <section class="panel profile">
    <Avatar name={user?.name ?? "?"} id={user?.id} src={preview ?? user?.avatar} size={72} />
    <div class="who">
      <div class="name selectable">{user?.name ?? "…"}</div>
      <div class="email selectable">{user?.email ?? ""}</div>
      <div class="actions avatar-actions">
        <input bind:this={fileInput} type="file" accept={AVATAR_TYPES.join(",")} hidden onchange={onPickAvatar} aria-label={t("settings.pickAvatar")} />
        <button type="button" class="btn" disabled={avatarBusy} onclick={() => fileInput.click()}>
          {#if avatarBusy}<span class="spinner"></span>{/if} {user?.avatar ? t("settings.changePhoto") : t("settings.addPhoto")}
        </button>
        {#if user?.avatar}
          <button type="button" class="btn btn-ghost" disabled={avatarBusy} onclick={onRemoveAvatar}>{t("common.remove")}</button>
        {/if}
      </div>
      {#if avatarError}
        <span class="field-error" role="alert">{avatarError}</span>
      {:else}
        <span class="hint">{t("settings.avatarHint")}</span>
      {/if}
    </div>
  </section>

  <form class="panel" onsubmit={onSaveName}>
    <div class="field">
      <label for="display-name">{t("signup.name")}</label>
      <input
        id="display-name"
        class="input"
        bind:value={name}
        maxlength={MAX_NAME_LENGTH}
        autocomplete="name"
        aria-describedby={nameError ? "display-name-err" : "display-name-hint"}
        aria-invalid={nameError ? "true" : undefined}
      />
      {#if nameError}
        <span class="field-error" id="display-name-err" role="alert">{nameError}</span>
      {:else}
        <span class="hint" id="display-name-hint">{t("settings.nameHint")}</span>
      {/if}
    </div>
    <div class="actions">
      <button type="submit" class="btn btn-primary" disabled={!nameChanged || savingName}>
        {#if savingName}<span class="spinner"></span>{/if} {t("common.save")}
      </button>
      {#if nameChanged}<button type="button" class="btn btn-ghost" onclick={() => ((name = user?.name ?? ""), (nameError = null))}>{t("common.cancel")}</button>{/if}
    </div>
  </form>

  <form class="panel" onsubmit={onSavePassword}>
    <div>
      <h2>{t("password.label")}</h2>
      <p class="sub">{t("settings.passwordHint")}</p>
    </div>
    <div class="field">
      <label for="current-password">{t("settings.currentPassword")}</label>
      <input id="current-password" class="input" type="password" bind:value={currentPassword} autocomplete="current-password" />
    </div>
    <div class="field">
      <label for="new-password">{t("settings.newPassword")}</label>
      <input id="new-password" class="input" type="password" bind:value={newPassword} autocomplete="new-password" />
    </div>
    <div class="field">
      <label for="confirm-password">{t("settings.confirmPassword")}</label>
      <input
        id="confirm-password"
        class="input"
        type="password"
        bind:value={confirmPassword}
        autocomplete="new-password"
        aria-describedby={passwordError ? "password-err" : undefined}
        aria-invalid={passwordError ? "true" : undefined}
      />
      {#if passwordError}<span class="field-error" id="password-err" role="alert">{passwordError}</span>{/if}
    </div>
    <div class="actions">
      <button type="submit" class="btn btn-primary" disabled={savingPassword || !currentPassword || !newPassword}>
        {#if savingPassword}<span class="spinner"></span>{/if} {t("settings.changePassword")}
      </button>
    </div>
  </form>

  <section class="panel">
    <div>
      <h2>{t("userMenu.appearance")}</h2>
      <p class="sub">{t("settings.themeHint")}</p>
    </div>
    <div class="theme"><ThemeSwitch /></div>
  </section>

  <section class="panel">
    <div>
      <h2>{t("lang.label")}</h2>
      <p class="sub">{t("settings.langHint")}</p>
    </div>
    <div><LangSwitch /></div>
  </section>

  <section class="panel">
    <div class="row-between">
      <div>
        <h2>{t("settings.session")}</h2>
        <p class="sub">{t("settings.sessionText")}</p>
      </div>
      <button type="button" class="btn" onclick={onLogout}><Icon name="logout" size={16} /> {t("userMenu.logout")}</button>
    </div>
  </section>

  <section class="panel panel-danger">
    <div class="row-between">
      <div>
        <h2>{t("settings.deleteAccount")}</h2>
        <p class="sub">{t("settings.deleteHint")}</p>
      </div>
      <button type="button" class="btn btn-danger" disabled={busy} onclick={onDelete}>
        {#if busy}<span class="spinner"></span>{:else}<Icon name="trash" size={16} />{/if} {t("common.delete")}
      </button>
    </div>
  </section>

</main>

<dialog class="modal" bind:this={dialog} aria-labelledby="handover-title" onclose={() => (handover = null)}>
  {#if handover}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        if (transferTo) void attemptDelete(transferTo);
      }}
    >
      <h2 id="handover-title">{t("settings.handoverTitle")}</h2>
      <p class="sub">
        {#if handover.reason === "last_admin"}
          {t("settings.handoverLastAdmin")}
        {:else}
          {t("settings.handoverTransfer")}
        {/if}
      </p>
      <ul>
        {#each handover.projects as project (project.id)}
          <li><Icon name="folder" size={15} /> <a href={`/app/${project.id}/settings#membres`}>{project.name}</a></li>
        {/each}
      </ul>

      {#if handover.candidates.length === 0}
        <div class="alert alert-warn">
          <Icon name="info" size={17} />
          <span>{t("settings.handoverNone")}</span>
        </div>
      {:else}
        <div class="field">
          <label for="transfer-to">{t("settings.newOwner")}</label>
          <select id="transfer-to" class="input" bind:value={transferTo}>
            <option value="">{t("common.choose")}</option>
            {#each handover.candidates as person (person.id)}<option value={person.id}>{person.name} — {person.email}</option>{/each}
          </select>
        </div>
      {/if}

      <div class="actions">
        <button type="button" class="btn btn-ghost" onclick={closeHandover}>{t("common.cancel")}</button>
        <button type="submit" class="btn btn-danger" disabled={!transferTo || busy}>{t("settings.transferDelete")}</button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  .actions {
    display: flex;
    gap: 8px;
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 640px;
    margin: 0 auto;
    padding: 40px 20px 80px;
  }
  main h1 {
    margin-bottom: 4px;
  }
  .who {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
  }
  .avatar-actions {
    justify-content: flex-start;
    margin: 10px 0 6px;
  }
  .profile {
    flex-direction: row;
    align-items: center;
    gap: 18px;
  }
  .name {
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 600;
  }
  .email {
    color: var(--text-soft);
  }
  .sub {
    margin-top: 4px;
    color: var(--text-soft);
    font-size: 0.92rem;
  }
  .theme {
    max-width: 340px;
  }
  dialog {
    width: min(480px, calc(100vw - 24px));
  }
  dialog form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 24px;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }
</style>
