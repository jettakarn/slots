import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const SLOT_COUNT = 5;

const PRESET_IDS = ['default', 'macos', 'custom'];

const DEFAULT_APPS = [
    {
        id: 'org.gnome.Terminal.desktop',
        keywords: ['kgx', 'ptyxis', 'gnome-terminal', 'org.gnome.Console', 'terminal'],
    },
    {
        id: 'org.gnome.Nautilus.desktop',
        keywords: ['nautilus', 'org.gnome.Nautilus', 'files'],
    },
    {
        id: '',
        scheme: 'https',
        keywords: ['firefox', 'chrome', 'chromium', 'brave', 'epiphany'],
    },
    null,
    null,
];

const PRESET_TABLES = {
    default: [
        slot('Terminal', 'app', 'terminal'),
        slot('Files', 'app', 'files'),
        slot('Browser', 'app', 'browser'),
        slot('', 'app', '', false),
        slot('', 'app', '', false),
    ],
    macos: [
        slot('Files', 'app', 'files'),
        slot('Apps', 'apps', ''),
        slot('Browser', 'app', 'browser'),
        slot('Mail', 'app', 'mail'),
        slot('Settings', 'app', 'settings'),
    ],
};

function slot(label, action, app, enabled = true) {
    return {
        enabled,
        label,
        icon: '',
        display: 'text',
        action,
        app,
        url: '',
    };
}

function desktopExists(id) {
    if (!id)
        return false;
    try {
        return Gio.DesktopAppInfo.new(id) !== null;
    } catch (e) {
        return false;
    }
}

function appIdForScheme(scheme) {
    try {
        return Gio.AppInfo.get_default_for_uri_scheme(scheme)?.get_id?.() || null;
    } catch (e) {
        return null;
    }
}

function findAppByKeywords(keywords) {
    const apps = Gio.AppInfo.get_all();
    for (const keyword of keywords) {
        const needle = keyword.toLowerCase();
        for (const app of apps) {
            try {
                if (app.should_show && !app.should_show())
                    continue;
                const id = (app.get_id?.() || '').toLowerCase();
                const name = (app.get_name?.() || '').toLowerCase();
                const exec = (app.get_executable?.() || '').toLowerCase();
                if (id.includes(needle) || name.includes(needle) || exec.includes(needle))
                    return app.get_id() || null;
            } catch (e) {
                // Skip an app info the desktop file database cannot read.
            }
        }
    }
    return null;
}

export function resolveAppId(slotIndex, storedId) {
    if (desktopExists(storedId))
        return storedId;

    const fallback = DEFAULT_APPS[slotIndex];
    if (!fallback)
        return null;

    const missingDefault = !storedId || storedId === fallback.id;
    if (!missingDefault)
        return null;

    if (fallback.scheme) {
        const id = appIdForScheme(fallback.scheme);
        if (desktopExists(id))
            return id;
    }
    if (desktopExists(fallback.id))
        return fallback.id;

    const found = findAppByKeywords(fallback.keywords || []);
    return desktopExists(found) ? found : null;
}

function resolveToken(token) {
    switch (token) {
    case 'terminal':
        return resolveAppId(0, '') || '';
    case 'files':
        return resolveAppId(1, '') || '';
    case 'browser':
        return resolveAppId(2, '') || '';
    case 'mail': {
        const id = appIdForScheme('mailto');
        return desktopExists(id) ? id : '';
    }
    case 'settings': {
        if (desktopExists('org.gnome.Settings.desktop'))
            return 'org.gnome.Settings.desktop';
        const found = findAppByKeywords(['gnome-control-center', 'org.gnome.Settings']);
        return desktopExists(found) ? found : '';
    }
    default:
        return token || '';
    }
}

export function presetSlots(name) {
    const table = PRESET_TABLES[name];
    if (!table)
        return null;
    return table.map(entry => ({
        ...entry,
        app: entry.action === 'app' ? resolveToken(entry.app) : '',
    }));
}

function writeSlot(settings, index, entry) {
    const n = index + 1;
    settings.set_boolean(`slot${n}-enabled`, entry.enabled);
    settings.set_string(`slot${n}-label`, entry.label);
    settings.set_string(`slot${n}-icon`, entry.icon);
    settings.set_string(`slot${n}-display`, entry.display);
    settings.set_string(`slot${n}-action`, entry.action);
    settings.set_string(`slot${n}-app`, entry.app);
    settings.set_string(`slot${n}-url`, entry.url);
}

export function applyPreset(settings, name) {
    const slots = presetSlots(name);
    if (!slots)
        return;
    settings.delay();
    slots.forEach((entry, index) => writeSlot(settings, index, entry));
    settings.set_string('preset', name);
    settings.apply();
}

export function presetIndex(value) {
    const index = PRESET_IDS.indexOf(value);
    return index === -1 ? PRESET_IDS.indexOf('custom') : index;
}

export function presetId(index) {
    return PRESET_IDS[index] || 'custom';
}

export function readSlot(settings, index) {
    const n = index + 1;
    const actionRaw = settings.get_string(`slot${n}-action`);
    const action = actionRaw === 'url' || actionRaw === 'apps' ? actionRaw : 'app';
    const displayRaw = settings.get_string(`slot${n}-display`);
    const display = displayRaw === 'icon' || displayRaw === 'both' ? displayRaw : 'text';
    return {
        index,
        enabled: settings.get_boolean(`slot${n}-enabled`),
        label: settings.get_string(`slot${n}-label`),
        icon: settings.get_string(`slot${n}-icon`).trim(),
        display,
        action,
        app: settings.get_string(`slot${n}-app`),
        url: settings.get_string(`slot${n}-url`),
    };
}

export function normalizeUrl(raw) {
    const text = (raw || '').trim();
    if (!text)
        return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(text))
        return text;
    return `https://${text}`;
}

function appName(id) {
    if (!id)
        return '';
    try {
        return Gio.DesktopAppInfo.new(id)?.get_name() || '';
    } catch (e) {
        return '';
    }
}

function hostOf(uri) {
    try {
        return GLib.Uri.parse(uri, GLib.UriFlags.NONE).get_host() || uri;
    } catch (e) {
        return uri;
    }
}

export function buttonLabel(slot, resolvedId, uri) {
    const custom = (slot.label || '').trim();
    if (custom)
        return custom;
    if (slot.action === 'apps')
        return 'Apps';
    if (slot.action === 'app')
        return appName(resolvedId);
    if (uri)
        return hostOf(uri);
    return '';
}

export function slotSubtitle(slot, resolvedId, uri) {
    if (slot.action === 'apps')
        return 'Opens the applications overview';
    if (slot.action === 'url')
        return uri ? `Opens ${hostOf(uri)}` : 'No URL';
    const name = appName(resolvedId);
    return name ? `Opens ${name}` : 'Not installed';
}

export function resolveButtonIcon(slot, resolvedId) {
    if (slot.display === 'text')
        return null;
    if (slot.icon)
        return { iconName: slot.icon };

    if (slot.action === 'app' && resolvedId) {
        try {
            const gicon = Gio.DesktopAppInfo.new(resolvedId)?.get_icon?.();
            if (gicon)
                return { gicon };
        } catch (e) {
            // Fall through to a generic icon.
        }
    }
    if (slot.action === 'url')
        return { iconName: 'web-browser-symbolic' };
    if (slot.action === 'apps')
        return { iconName: 'view-app-grid-symbolic' };
    return { iconName: 'application-x-executable-symbolic' };
}
