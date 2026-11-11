<script lang="ts">
  import Avatar from "./Avatar.svelte";
  import Icon from "./Icon.svelte";
  import Popover from "./Popover.svelte";
  import ThemeSwitch from "./ThemeSwitch.svelte";
  import LangSwitch from "./LangSwitch.svelte";
  import { t } from "../i18n.svelte";
  import { USER_UPDATED_EVENT, getStoredUser, logout, type AuthUser } from "../../auth/authClient";
  import { ensureUser } from "../session";

  let user = $state<AuthUser | null>(getStoredUser());

  $effect(() => {
    void ensureUser().then((u) => (user = u));
    const refresh = (): void => {
      user = getStoredUser();
    };
    window.addEventListener(USER_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(USER_UPDATED_EVENT, refresh);
  });

  async function onLogout(): Promise<void> {
    await logout();
    window.location.href = "/login";
  }
</script>

<Popover width={270}>
  {#snippet trigger({ open, toggle })}
    <button type="button" class="trigger" aria-label={t("userMenu.label")} aria-expanded={open} onclick={toggle}>
      <Avatar name={user?.name ?? "?"} id={user?.id} src={user?.avatar} size={32} />
    </button>
  {/snippet}
  {#snippet children({ close })}
    {#if user}
      <div class="who">
        <Avatar name={user.name} id={user.id} src={user.avatar} size={38} />
        <div class="who-text">
          <div class="who-name selectable">{user.name}</div>
          <div class="who-email selectable">{user.email}</div>
        </div>
      </div>
    {/if}
    <div class="section">
      <div class="label">{t("userMenu.appearance")}</div>
      <ThemeSwitch />
      <div class="lang"><LangSwitch /></div>
    </div>
    <div class="divider"></div>
    <a class="item" href="/app" onclick={close}><Icon name="folder" size={16} /> {t("userMenu.projects")}</a>
    <a class="item" href="/settings" onclick={close}><Icon name="settings" size={16} /> {t("userMenu.settings")}</a>
    <div class="divider"></div>
    <button type="button" class="item" onclick={onLogout}><Icon name="logout" size={16} /> {t("userMenu.logout")}</button>
  {/snippet}
</Popover>

<style>
  .lang {
    margin-top: 6px;
  }
  .lang :global(.switch) {
    width: 100%;
  }
  .lang :global(select) {
    flex: 1;
  }
  .trigger {
    display: inline-flex;
    padding: 2px;
    border: none;
    border-radius: 50%;
    background: transparent;
    transition: box-shadow 0.15s var(--ease);
  }
  .trigger:hover {
    box-shadow: 0 0 0 3px var(--bg-sunken);
  }
  .who {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
  }
  .who-text {
    min-width: 0;
  }
  .who-name {
    font-weight: 650;
    font-size: 0.92rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .who-email {
    font-size: 0.78rem;
    color: var(--text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .section {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .divider {
    height: 1px;
    background: var(--line);
    margin: 4px 2px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 10px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font-size: 0.9rem;
    text-align: left;
    text-decoration: none;
  }
  .item:hover {
    background: var(--bg-sunken);
    color: var(--text);
  }
</style>
