import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const SLOT_COUNT = 3;

const DEFAULT_APPS = [
    {
        id: 'org.gnome.Terminal.desktop',
        keywords: ['kgx', 'ptyxis', 'gnome-terminal', 'org.gnome.Console', 'terminal'],
    },
    {
        id: 'org.gnome.Nautilus.desktop',
        keywords: ['nautilus', 'org.gnome.Nautilus', 'files'],
    },
    null,
];

function desktopExists(id) {
    if (!id)
        return false;
    try {
        return Gio.DesktopAppInfo.new(id) !== null;
    } catch (e) {
        return false;
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

function resolveAppId(slotIndex, storedId) {
    if (desktopExists(storedId))
        return storedId;

    const fallback = DEFAULT_APPS[slotIndex];
    if (!fallback)
        return null;

    const missingDefault = !storedId || storedId === fallback.id;
    if (!missingDefault)
        return null;

    const found = findAppByKeywords(fallback.keywords);
    return desktopExists(found) ? found : null;
}

function normalizeUrl(raw) {
    const text = (raw || '').trim();
    if (!text)
        return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(text))
        return text;
    return `https://${text}`;
}

function displayLabel(slot, resolvedId, uri) {
    const custom = (slot.label || '').trim();
    if (custom)
        return custom;

    if (slot.action === 'app' && resolvedId) {
        try {
            return Gio.DesktopAppInfo.new(resolvedId)?.get_name() || '';
        } catch (e) {
            return '';
        }
    }

    if (!uri)
        return '';
    try {
        return GLib.Uri.parse(uri, GLib.UriFlags.NONE).get_host() || uri;
    } catch (e) {
        return uri;
    }
}

function readSlot(settings, index) {
    const n = index + 1;
    const action = settings.get_string(`slot${n}-action`) === 'url' ? 'url' : 'app';
    return {
        index,
        enabled: settings.get_boolean(`slot${n}-enabled`),
        label: settings.get_string(`slot${n}-label`),
        icon: settings.get_string(`slot${n}-icon`).trim(),
        action,
        app: settings.get_string(`slot${n}-app`),
        url: settings.get_string(`slot${n}-url`),
    };
}

function launchApp(desktopId) {
    const app = Shell.AppSystem.get_default().lookup_app(desktopId);
    if (!app) {
        log(`Slots: application ${desktopId} is not installed`);
        return;
    }
    app.activate();
}

function launchUrl(uri) {
    try {
        if (!Gio.AppInfo.launch_default_for_uri(uri, null))
            log(`Slots: no application can open ${uri}`);
    } catch (e) {
        logError(e, `Slots: failed to open ${uri}`);
    }
}

const SlotButton = GObject.registerClass(
class SlotButton extends PanelMenu.Button {
    constructor(label, iconName, onActivate) {
        super(0.0, label, true);
        this._onActivate = onActivate;
        this.accessible_role = Atk.Role.PUSH_BUTTON;

        const text = new St.Label({
            text: label,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.label_actor = text;

        if (!iconName) {
            this.add_child(text);
            return;
        }

        const box = new St.BoxLayout({
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(new St.Icon({
            icon_name: iconName,
            icon_size: 16,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-right: 6px;',
        }));
        box.add_child(text);
        this.add_child(box);
    }

    vfunc_event(event) {
        const type = event.type();
        const pressed = type === Clutter.EventType.BUTTON_PRESS ||
            type === Clutter.EventType.TOUCH_BEGIN;
        if (!pressed)
            return Clutter.EVENT_PROPAGATE;
        if (type === Clutter.EventType.BUTTON_PRESS &&
            event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        this._onActivate();
        return Clutter.EVENT_STOP;
    }
});

export default class SlotsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._buttons = [];
        this._rebuild();
        this._changedId = this._settings.connect('changed', () => this._rebuild());
    }

    disable() {
        if (this._changedId) {
            this._settings.disconnect(this._changedId);
            this._changedId = 0;
        }
        this._clear();
        this._settings = null;
    }

    _clear() {
        for (const button of this._buttons)
            button.destroy();
        this._buttons = [];
    }

    _rebuild() {
        this._clear();

        for (let i = 0; i < SLOT_COUNT; i++) {
            const slot = readSlot(this._settings, i);
            if (!slot.enabled)
                continue;

            const resolvedId = slot.action === 'app'
                ? resolveAppId(slot.index, slot.app)
                : null;
            const uri = slot.action === 'url' ? normalizeUrl(slot.url) : null;
            if (slot.action === 'app' && !resolvedId)
                continue;
            if (slot.action === 'url' && !uri)
                continue;

            const label = displayLabel(slot, resolvedId, uri);
            if (!label)
                continue;

            const button = new SlotButton(label, slot.icon, () => {
                if (slot.action === 'url')
                    launchUrl(uri);
                else
                    launchApp(resolvedId);
            });

            const position = Main.panel._leftBox?.get_n_children?.() ?? 0;
            Main.panel.addToStatusArea(`slots-${i + 1}`, button, position, 'left');
            this._buttons.push(button);
        }
    }
}
