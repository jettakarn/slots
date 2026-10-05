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

import { MenuBar } from './lib/menuBar.js';
import {
    SLOT_COUNT,
    readSlot,
    resolveAppId,
    normalizeUrl,
    buttonLabel,
    resolveButtonIcon,
} from './lib/presets.js';

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

function showApplications() {
    Main.overview.showApps();
}

function iconActor(icon, withLabel) {
    const params = {
        icon_size: 16,
        y_align: Clutter.ActorAlign.CENTER,
    };
    if (icon.gicon)
        params.gicon = icon.gicon;
    else
        params.icon_name = icon.iconName;
    if (withLabel)
        params.style = 'margin-right: 6px;';
    return new St.Icon(params);
}

const SlotButton = GObject.registerClass(
class SlotButton extends PanelMenu.Button {
    constructor(label, icon, showText, onActivate) {
        super(0.0, label, true);
        this._onActivate = onActivate;
        this.accessible_role = Atk.Role.PUSH_BUTTON;

        const text = new St.Label({
            text: label,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.label_actor = text;

        if (!icon) {
            this.add_child(text);
            return;
        }

        const graphic = iconActor(icon, showText);
        if (!showText) {
            this.add_child(graphic);
            return;
        }

        const box = new St.BoxLayout({
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(graphic);
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
        this._rebuildIdle = 0;
        this._menuBar = new MenuBar();
        this._menuBar.enable();
        this._rebuild();
        this._changedId = this._settings.connect('changed', () => {
            this._onSettingsChanged();
        });
    }

    disable() {
        if (this._changedId) {
            this._settings.disconnect(this._changedId);
            this._changedId = 0;
        }
        if (this._rebuildIdle) {
            GLib.source_remove(this._rebuildIdle);
            this._rebuildIdle = 0;
        }
        this._menuBar?.disable();
        this._menuBar = null;
        this._clear();
        this._settings = null;
    }

    _onSettingsChanged() {
        this._scheduleRebuild();
    }

    _scheduleRebuild() {
        if (this._rebuildIdle)
            return;
        this._rebuildIdle = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._rebuildIdle = 0;
            if (this._settings)
                this._rebuild();
            return GLib.SOURCE_REMOVE;
        });
    }

    _clear() {
        for (const button of this._buttons)
            button.destroy();
        this._buttons = [];
    }

    _slotPosition() {
        const box = Main.panel._leftBox;
        const name = Main.panel.statusArea['slots-app']?.container;
        if (box?.get_children && name) {
            const children = box.get_children();
            for (let i = 0; i < children.length; i++) {
                if (children[i] === name)
                    return i + 1 + this._buttons.length;
            }
        }
        const activities = Main.panel.statusArea.activities?.container;
        if (box?.get_children && activities) {
            const children = box.get_children();
            for (let i = 0; i < children.length; i++) {
                if (children[i] === activities)
                    return i + 1 + this._buttons.length;
            }
        }
        return box?.get_n_children?.() ?? 0;
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

            const label = buttonLabel(slot, resolvedId, uri);
            if (!label)
                continue;

            const icon = resolveButtonIcon(slot, resolvedId);
            const showText = slot.display !== 'icon' || !icon;
            const button = new SlotButton(label, icon, showText, () => {
                if (slot.action === 'url')
                    launchUrl(uri);
                else if (slot.action === 'apps')
                    showApplications();
                else
                    launchApp(resolvedId);
            });

            Main.panel.addToStatusArea(`slots-${i + 1}`, button, this._slotPosition(), 'left');
            this._buttons.push(button);
        }
    }
}
