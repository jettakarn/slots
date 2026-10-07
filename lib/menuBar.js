import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const SKIPPED_WINDOW_TYPES = new Set([
    Meta.WindowType.DESKTOP,
    Meta.WindowType.DOCK,
    Meta.WindowType.SPLASHSCREEN,
    Meta.WindowType.DROPDOWN_MENU,
    Meta.WindowType.MENU,
    Meta.WindowType.POPUP_MENU,
    Meta.WindowType.TOOLTIP,
    Meta.WindowType.NOTIFICATION,
    Meta.WindowType.OVERRIDE_OTHER,
].filter(type => type !== undefined));

function isDesktopShell(window) {
    try {
        const appId = window.gtk_application_id || '';
        if (appId === 'com.rastersoft.ding' || appId === 'com.rastersoft.dingtest')
            return true;
    } catch (e) {
        // This window has no GTK application id.
    }
    try {
        const wmClass = (window.get_wm_class?.() || '').toLowerCase();
        if (wmClass === 'gjs' && window.is_skip_taskbar?.())
            return true;
    } catch (e) {
        // This window does not expose a WM class.
    }
    return false;
}

function focusedWindow() {
    const window = global.display.focus_window;
    if (!window)
        return null;
    try {
        if (SKIPPED_WINDOW_TYPES.has(window.get_window_type()))
            return null;
    } catch (e) {
        return null;
    }
    if (isDesktopShell(window))
        return null;
    return window;
}

function applicationName(window) {
    try {
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        const name = app?.get_name?.();
        if (name && name.toLowerCase() !== 'gjs')
            return name;
    } catch (e) {
        // Fall back to the window title.
    }
    try {
        return window.get_title() || '';
    } catch (e) {
        return '';
    }
}

function indexAfterActivities() {
    const box = Main.panel._leftBox;
    const container = Main.panel.statusArea.activities?.container;
    if (!box?.get_children || !container)
        return 0;
    const children = box.get_children();
    for (let i = 0; i < children.length; i++) {
        if (children[i] === container)
            return i + 1;
    }
    return 0;
}

function nameButton(label) {
    const button = new PanelMenu.Button(0.0, label, true);
    button.reactive = false;
    button.track_hover = false;
    button.can_focus = false;
    const text = new St.Label({
        text: label,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style: 'font-weight: bold;',
    });
    button.label_actor = text;
    button.add_child(text);
    return button;
}

export class MenuBar {
    constructor() {
        this._button = null;
        this._windowSignals = [];
        this._followed = null;
        this._focusId = 0;
        this._idle = 0;
        this._enabled = false;
    }

    enable() {
        this._enabled = true;
        this._focusId = global.display.connect('notify::focus-window', () => this._schedule());
        this._rebuild();
    }

    disable() {
        this._enabled = false;
        if (this._focusId) {
            global.display.disconnect(this._focusId);
            this._focusId = 0;
        }
        if (this._idle) {
            GLib.source_remove(this._idle);
            this._idle = 0;
        }
        this._unfollow();
        this._destroyButton();
    }

    _schedule() {
        if (!this._enabled || this._idle)
            return;
        this._idle = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idle = 0;
            if (this._enabled)
                this._rebuild();
            return GLib.SOURCE_REMOVE;
        });
    }

    _unfollow() {
        if (this._followed) {
            for (const id of this._windowSignals) {
                try {
                    this._followed.disconnect(id);
                } catch (e) {
                    // The window may already be unmanaged.
                }
            }
        }
        this._followed = null;
        this._windowSignals = [];
    }

    _follow(window) {
        if (this._followed === window)
            return;
        this._unfollow();
        this._followed = window;
        if (!window)
            return;
        for (const signal of ['notify::title', 'unmanaged']) {
            try {
                this._windowSignals.push(window.connect(signal, () => this._schedule()));
            } catch (e) {
                // This window does not emit the signal.
            }
        }
    }

    _destroyButton() {
        this._button?.destroy();
        this._button = null;
    }

    _rebuild() {
        if (!this._enabled)
            return;
        this._destroyButton();

        const window = focusedWindow();
        this._follow(window);
        if (!window)
            return;

        const name = applicationName(window);
        if (!name)
            return;

        this._button = nameButton(name);
        Main.panel.addToStatusArea('slots-app', this._button, indexAfterActivities(), 'left');
    }
}
