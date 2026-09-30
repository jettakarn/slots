import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SLOT_COUNT = 3;

function describeApp(id) {
    if (!id)
        return 'None selected';
    try {
        const info = Gio.DesktopAppInfo.new(id);
        if (info)
            return info.get_name();
    } catch (e) {
        // The stored desktop id is no longer installed.
    }
    return 'Not installed';
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

function addSlot(page, window, settings, index) {
    const n = index + 1;
    const enabledKey = `slot${n}-enabled`;
    const labelKey = `slot${n}-label`;
    const iconKey = `slot${n}-icon`;
    const actionKey = `slot${n}-action`;
    const appKey = `slot${n}-app`;
    const urlKey = `slot${n}-url`;

    const group = new Adw.PreferencesGroup({
        title: `Slot ${n}`,
    });
    page.add(group);

    const enabledRow = new Adw.SwitchRow({ title: 'Enabled' });
    group.add(enabledRow);
    settings.bind(enabledKey, enabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);

    const titleRow = new Adw.EntryRow({ title: 'Title' });
    group.add(titleRow);
    settings.bind(labelKey, titleRow, 'text', Gio.SettingsBindFlags.DEFAULT);

    const iconRow = new Adw.EntryRow({ title: 'Icon name' });
    group.add(iconRow);
    settings.bind(iconKey, iconRow, 'text', Gio.SettingsBindFlags.DEFAULT);

    const types = new Gtk.StringList();
    types.append('Application');
    types.append('Website');
    const typeRow = new Adw.ComboRow({
        title: 'Type',
        model: types,
        selected: settings.get_string(actionKey) === 'url' ? 1 : 0,
    });
    group.add(typeRow);

    const appRow = new Adw.ActionRow({
        title: 'Application',
        subtitle: describeApp(settings.get_string(appKey)),
    });
    const choose = new Gtk.Button({
        label: 'Choose',
        valign: Gtk.Align.CENTER,
    });
    choose.connect('clicked', () => {
        chooseApplication(window, id => settings.set_string(appKey, id));
    });
    appRow.add_suffix(choose);
    appRow.activatable_widget = choose;
    group.add(appRow);

    const urlRow = new Adw.EntryRow({ title: 'URL' });
    group.add(urlRow);
    settings.bind(urlKey, urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);

    const syncType = () => {
        const isUrl = settings.get_string(actionKey) === 'url';
        const selected = isUrl ? 1 : 0;
        if (typeRow.selected !== selected)
            typeRow.selected = selected;
        appRow.visible = !isUrl;
        urlRow.visible = isUrl;
    };

    typeRow.connect('notify::selected', () => {
        const action = typeRow.selected === 1 ? 'url' : 'app';
        if (settings.get_string(actionKey) !== action)
            settings.set_string(actionKey, action);
    });
    settings.connect(`changed::${actionKey}`, syncType);
    settings.connect(`changed::${appKey}`, () => {
        appRow.subtitle = describeApp(settings.get_string(appKey));
    });
    syncType();
}

export default class SlotsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        for (let i = 0; i < SLOT_COUNT; i++)
            addSlot(page, window, settings, i);
    }
}
