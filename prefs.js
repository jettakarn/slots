import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    SLOT_COUNT,
    applyPreset,
    presetId,
    presetIndex,
    readSlot,
    resolveAppId,
    normalizeUrl,
    buttonLabel,
    slotSubtitle,
    resolveButtonIcon,
} from './lib/presets.js';

const ACTIONS = ['app', 'url', 'apps'];
const DISPLAYS = ['text', 'icon', 'both'];

function installedName(id) {
    if (!id)
        return '';
    try {
        return Gio.DesktopAppInfo.new(id)?.get_name() || '';
    } catch (e) {
        return '';
    }
}

function chooseApplication(parent, onPick) {
    const dialog = Gtk.AppChooserDialog.new_for_content_type(
        parent,
        Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT,
        'application/octet-stream');
    dialog.set_heading('Choose Application');

    const widget = dialog.get_widget();
    if (widget) {
        widget.set_show_all(true);
        widget.set_show_other(true);
        widget.refresh?.();
    }

    dialog.connect('response', (dlg, response) => {
        if (response === Gtk.ResponseType.OK) {
            const info = dlg.get_app_info();
            const id = info?.get_id?.();
            if (id)
                onPick(id);
        }
        dlg.destroy();
    });
    dialog.present();
}

function assignSelected(row, index) {
    if (row.selected === index)
        return;
    row._slotsUpdating = true;
    row.selected = index;
    row._slotsUpdating = false;
}

function stringList(labels) {
    const model = new Gtk.StringList();
    for (const label of labels)
        model.append(label);
    return model;
}

function addSlot(group, window, settings, index) {
    const n = index + 1;
    const enabledKey = `slot${n}-enabled`;
    const labelKey = `slot${n}-label`;
    const iconKey = `slot${n}-icon`;
    const displayKey = `slot${n}-display`;
    const actionKey = `slot${n}-action`;
    const appKey = `slot${n}-app`;
    const urlKey = `slot${n}-url`;

    const row = new Adw.ExpanderRow({
        title: `Slot ${n}`,
        show_enable_switch: true,
    });
    group.add(row);
    settings.bind(enabledKey, row, 'enable-expansion', Gio.SettingsBindFlags.DEFAULT);

    const titleRow = new Adw.EntryRow({ title: 'Title' });
    row.add_row(titleRow);
    settings.bind(labelKey, titleRow, 'text', Gio.SettingsBindFlags.DEFAULT);

    const typeRow = new Adw.ComboRow({
        title: 'Type',
        model: stringList(['Application', 'Website', 'Show Applications']),
    });
    row.add_row(typeRow);

    const appRow = new Adw.ActionRow({ title: 'Application' });
    const choose = new Gtk.Button({
        label: 'Choose',
        valign: Gtk.Align.CENTER,
    });
    choose.connect('clicked', () => {
        chooseApplication(window, id => settings.set_string(appKey, id));
    });
    appRow.add_suffix(choose);
    appRow.activatable_widget = choose;
    row.add_row(appRow);

    const urlRow = new Adw.EntryRow({ title: 'URL' });
    row.add_row(urlRow);
    settings.bind(urlKey, urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);

    const displayRow = new Adw.ComboRow({
        title: 'Label style',
        model: stringList(['Text', 'Icon', 'Text and icon']),
    });
    row.add_row(displayRow);

    const iconRow = new Adw.EntryRow({ title: 'Icon name' });
    const preview = new Gtk.Image({
        pixel_size: 16,
        valign: Gtk.Align.CENTER,
    });
    iconRow.add_suffix(preview);
    row.add_row(iconRow);
    settings.bind(iconKey, iconRow, 'text', Gio.SettingsBindFlags.DEFAULT);

    typeRow.connect('notify::selected', () => {
        if (typeRow._slotsUpdating)
            return;
        const action = ACTIONS[typeRow.selected] || 'app';
        if (settings.get_string(actionKey) !== action)
            settings.set_string(actionKey, action);
    });
    displayRow.connect('notify::selected', () => {
        if (displayRow._slotsUpdating)
            return;
        const display = DISPLAYS[displayRow.selected] || 'text';
        if (settings.get_string(displayKey) !== display)
            settings.set_string(displayKey, display);
    });

    const refresh = () => {
        const slot = readSlot(settings, index);
        const resolvedId = slot.action === 'app' ? resolveAppId(index, slot.app) : null;
        const uri = slot.action === 'url' ? normalizeUrl(slot.url) : null;
        const label = buttonLabel(slot, resolvedId, uri);

        row.title = label || `Slot ${n}`;
        row.subtitle = slotSubtitle(slot, resolvedId, uri);

        assignSelected(typeRow, Math.max(ACTIONS.indexOf(slot.action), 0));
        assignSelected(displayRow, Math.max(DISPLAYS.indexOf(slot.display), 0));

        appRow.visible = slot.action === 'app';
        appRow.subtitle = installedName(resolvedId) || 'Not installed';
        urlRow.visible = slot.action === 'url';
        iconRow.visible = slot.display !== 'text';

        const icon = resolveButtonIcon({ ...slot, display: 'both' }, resolvedId);
        if (!icon) {
            preview.visible = false;
            return;
        }
        preview.visible = true;
        if (icon.gicon)
            preview.set_from_gicon(icon.gicon);
        else
            preview.set_from_icon_name(icon.iconName);
    };

    refresh();
    return refresh;
}

function buildButtonsPage(window, settings) {
    const page = new Adw.PreferencesPage({
        title: 'Buttons',
        icon_name: 'view-grid-symbolic',
    });

    const presetGroup = new Adw.PreferencesGroup({
        title: 'Preset',
        description: 'Choosing Default or macOS replaces every button. Editing a button switches the preset to Custom.',
    });
    page.add(presetGroup);

    const presetRow = new Adw.ComboRow({
        title: 'Preset',
        model: stringList(['Default', 'macOS', 'Custom']),
    });
    const reset = new Gtk.Button({
        label: 'Reset',
        valign: Gtk.Align.CENTER,
    });
    presetRow.add_suffix(reset);
    presetGroup.add(presetRow);

    const buttonGroup = new Adw.PreferencesGroup({
        title: 'Panel buttons',
        description: 'Each row is one button on the left side of the panel. Turn a row off to hide it.',
    });
    page.add(buttonGroup);

    const refreshers = [];
    for (let i = 0; i < SLOT_COUNT; i++)
        refreshers.push(addSlot(buttonGroup, window, settings, i));

    let applyingPreset = false;

    const syncPreset = () => {
        assignSelected(presetRow, presetIndex(settings.get_string('preset')));
        reset.sensitive = settings.get_string('preset') !== 'custom';
    };

    const refreshAll = () => {
        for (const refresh of refreshers)
            refresh();
    };

    const usePreset = name => {
        applyingPreset = true;
        try {
            applyPreset(settings, name);
        } finally {
            applyingPreset = false;
        }
        syncPreset();
        refreshAll();
    };

    presetRow.connect('notify::selected', () => {
        if (presetRow._slotsUpdating || applyingPreset)
            return;
        const name = presetId(presetRow.selected);
        if (name === 'custom') {
            if (settings.get_string('preset') !== 'custom')
                settings.set_string('preset', 'custom');
            return;
        }
        usePreset(name);
    });

    reset.connect('clicked', () => {
        const name = settings.get_string('preset');
        if (name === 'default' || name === 'macos')
            usePreset(name);
    });

    settings.connect('changed', (_settings, key) => {
        if (key === 'preset') {
            syncPreset();
            return;
        }
        if (applyingPreset || !key.startsWith('slot'))
            return;
        refreshAll();
        if (settings.get_string('preset') !== 'custom')
            settings.set_string('preset', 'custom');
    });

    syncPreset();
    return page;
}

function buildAboutPage(metadata) {
    const page = new Adw.PreferencesPage({
        title: 'About',
        icon_name: 'help-about-symbolic',
    });
    const shells = metadata['shell-version'];
    const group = new Adw.PreferencesGroup({
        description: metadata.description || '',
    });
    page.add(group);

    group.add(new Adw.ActionRow({
        title: 'Name',
        subtitle: metadata.name || 'Slots',
    }));
    group.add(new Adw.ActionRow({
        title: 'Version',
        subtitle: `${metadata.version ?? ''}`,
    }));
    group.add(new Adw.ActionRow({
        title: 'UUID',
        subtitle: metadata.uuid || 'slots@jettakarn',
    }));
    group.add(new Adw.ActionRow({
        title: 'GNOME Shell',
        subtitle: Array.isArray(shells) ? shells.join(', ') : `${shells || ''}`,
    }));

    const link = new Adw.ActionRow({
        title: 'Website',
        subtitle: 'github.com/jettakarn/slots',
        activatable: true,
    });
    link.connect('activated', () => {
        Gio.AppInfo.launch_default_for_uri('https://github.com/jettakarn/slots', null);
    });
    group.add(link);
    return page;
}

export default class SlotsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.add(buildButtonsPage(window, settings));
        window.add(buildAboutPage(this.metadata));
    }
}
