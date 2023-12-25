﻿import sQuery from "@optionaldeps/squery";
import { faIcon, getInstanceType, getTypeFullName, localText, resolveUrl, stringFormat, tryGetText } from "@serenity-is/base";
import { Decorators, DialogTypeAttribute, DisplayNameAttribute, EntityTypeAttribute, ItemNameAttribute, ServiceAttribute } from "../../decorators";
import { IEditDialog } from "../../interfaces";
import { Authorization, HandleRouteEventArgs, Router, replaceAll, safeCast } from "../../q";
import { RemoteViewOptions } from "../../slick";
import { DialogTypeRegistry } from "../../types/dialogtyperegistry";
import { EditorUtils } from "../editors/editorutils";
import { SubDialogHelper } from "../helpers/subdialoghelper";
import { ToolButton } from "../widgets/toolbar";
import { Widget, WidgetProps } from "../widgets/widget";
import { ColumnPickerDialog } from "./columnpickerdialog";
import { DataGrid } from "./datagrid";

@Decorators.registerClass('Serenity.EntityGrid')
export class EntityGrid<TItem, P = {}> extends DataGrid<TItem, P> {

    constructor(props: WidgetProps<P>) {
        super(props);
        this.domNode.classList.add('route-handler');
        this.element.on('handleroute.' + this.uniqueName, (_, args: any) => this.handleRoute(args));
    }

    protected handleRoute(args: HandleRouteEventArgs): void {
        if (!!args.handled)
            return;

        if (!!(args.route === 'new')) {
            args.handled = true;
            this.addButtonClick();
            return;
        }

        var oldRequests = (sQuery as any)?.["active"];

        var parts = args.route.split('/');
        if (!!(parts.length === 2 && parts[0] === 'edit')) {
            args.handled = true;
            this.editItem(decodeURIComponent(parts[1]));
        }
        else if (!!(parts.length === 2 && parts[1] === 'new')) {
            args.handled = true;
            this.editItemOfType(parts[0], null);
        }
        else if (!!(parts.length === 3 && parts[1] === 'edit')) {
            args.handled = true;
            this.editItemOfType(parts[0], decodeURIComponent(parts[2]));
        }
        else
            return;

        if ((sQuery as any)?.["active"] > oldRequests && args.handled && args.index >= 0 && args.index < args.parts.length - 1) {
            sQuery(document).one('ajaxStop', () => {
                setTimeout(() => Router.resolve('#' + args.parts.join('/+/')), 1);
            });
        }
    }

    protected usePager(): boolean {
        return true;
    }

    protected createToolbarExtensions(): void {
        this.createIncludeDeletedButton();
        this.createQuickSearchInput();
    }

    protected getInitialTitle(): string {
        return this.getDisplayName();
    }

    protected getLocalTextPrefix(): string {
        var result = super.getLocalTextPrefix();

        if (result != null ||
            this.getRowDefinition())
            return result;
            
        return this.getEntityType();
    }

    private _entityType: string;

    protected getEntityType(): string {
        if (this._entityType != null)
            return this._entityType;

        var attr = this.attrs(EntityTypeAttribute);

        if (attr.length === 1) {
            return (this._entityType = attr[0].value);
        }

        var name = getTypeFullName(getInstanceType(this));

        var px = name.indexOf('.');
        if (px >= 0) {
            name = name.substring(px + 1);
        }

        if (name.endsWith('Grid')) {
            name = name.substring(0, name.length - 4);
        }
        else if (name.endsWith('SubGrid')) {
            name = name.substring(0, name.length - 7);
        }

        this._entityType = name;

        return this._entityType;
    }

    private _displayName: string;

    protected getDisplayName(): string {
        if (this._displayName != null)
            return this._displayName;

        var attr = this.attrs(DisplayNameAttribute);
        if (attr.length >= 1) {
            this._displayName = attr[0].displayName;
            this._displayName = localText(this._displayName, this._displayName);
        }
        else {
            this._displayName = tryGetText(this.getLocalTextDbPrefix() + 'EntityPlural');
            if (this._displayName == null)
                this._displayName = this.getEntityType();
        }

        return this._displayName;
    }

    private _itemName: string;

    protected getItemName(): string {
        if (this._itemName != null)
            return this._itemName;

        var attr = this.attrs(ItemNameAttribute);
        if (attr.length >= 1) {
            this._itemName = attr[0].value;
            this._itemName = localText(this._itemName, this._itemName);
        }
        else {
            this._itemName = tryGetText(this.getLocalTextDbPrefix() + 'EntitySingular');
            if (this._itemName == null)
                this._itemName = this.getEntityType();
        }

        return this._itemName;
    }

    protected getAddButtonCaption(): string {
        return stringFormat(localText('Controls.EntityGrid.NewButton'), this.getItemName());
    }

    protected getButtons(): ToolButton[] {

        var buttons: ToolButton[] = [];
        buttons.push({
            title: this.getAddButtonCaption(),
            action: 'add',
            cssClass: 'add-button',
            icon: faIcon("plus-circle", "green"),
            hotkey: 'alt+n',
            onClick: () => {
                this.addButtonClick();
            },
            disabled: () => !this.hasInsertPermission() || this.readOnly
        });

        buttons.push(this.newRefreshButton(true));
        buttons.push(ColumnPickerDialog.createToolButton(this as any));

        return buttons;
    }

    protected newRefreshButton(noText?: boolean): ToolButton {
        return {
            title: (noText ? null : localText('Controls.EntityGrid.RefreshButton')),
            hint: (noText ? localText('Controls.EntityGrid.RefreshButton') : null),
            icon: faIcon("refresh", "blue"),
            action: 'refresh',
            cssClass: 'refresh-button',
            onClick: () => {
                this.refresh();
            }
        };
    }

    protected addButtonClick(): void {
        this.editItem(new Object());
    }

    protected editItem(entityOrId: any): void {
        this.createEntityDialog(this.getItemType(), dlg => {
            var dialog = safeCast(dlg, IEditDialog);
            if (dialog != null) {
                dialog.load(entityOrId, () => {
                    dialog.dialogOpen(this.openDialogsAsPanel);
                });

                return;
            }

            throw new Error(
                stringFormat("{0} doesn't implement IEditDialog!",
                    getTypeFullName(getInstanceType(dlg))));
        });
    }

    protected editItemOfType(itemType: string, entityOrId: any): void {

        if (itemType === this.getItemType()) {
            this.editItem(entityOrId);
            return;
        }

        this.createEntityDialog(itemType, dlg => {
            var dialog = safeCast(dlg, IEditDialog);
            if (dialog != null) {
                dialog.load(entityOrId, () =>
                    dialog.dialogOpen(this.openDialogsAsPanel));
                return;
            }

            throw new Error(
                stringFormat("{0} doesn't implement IEditDialog!",
                    getTypeFullName(getInstanceType(dlg))));
        });
    }

    private _service: string;

    protected getService(): string {
        if (this._service != null)
            return this._service;

        var attr = this.attrs(ServiceAttribute);
        if (attr.length >= 1)
            this._service = attr[0].value;
        else
            this._service = replaceAll(this.getEntityType(), '.', '/');

        return this._service;
    }

    protected getViewOptions(): RemoteViewOptions {
        var opt = super.getViewOptions();
        opt.url = resolveUrl('~/Services/' + this.getService() + '/List');
        return opt;
    }

    protected getItemType() {
        return this.getEntityType();
    }

    protected routeDialog(itemType: string, dialog: Widget<any>) {
        Router && Router.dialog && Router.dialog(this.element, dialog.element, () => {
            var hash = '';

            if (itemType !== this.getItemType())
                hash = itemType + '/';

            if (!!(dialog != null && (dialog as any).entityId != null))
                hash += 'edit/' + (dialog as any).entityId.toString();
            else
                hash += 'new';

            return hash;
        });
    }

    protected getInsertPermission(): string {
        return this.getRowDefinition()?.insertPermission;
    }

    protected hasInsertPermission(): boolean {
        var insertPermission = this.getInsertPermission();
        return insertPermission == null || Authorization.hasPermission(this.getInsertPermission());
    }

    protected transferDialogReadOnly(dialog: Widget<any>) {
        if (this.readOnly)
            EditorUtils.setReadOnly(dialog, true);
    }

    protected initDialog(dialog: Widget<any>): void {
        SubDialogHelper.bindToDataChange(dialog, this, (e, dci) => {
            this.subDialogDataChange();
        }, true);

        this.transferDialogReadOnly(dialog);
        this.routeDialog(this.getItemType(), dialog);
    }

    protected initEntityDialog(itemType: string, dialog: Widget<any>): void {
        if (itemType === this.getItemType()) {
            this.initDialog(dialog);
            return;
        }

        SubDialogHelper.bindToDataChange(dialog, this, (e, dci) => {
            this.subDialogDataChange();
        }, true);

        this.transferDialogReadOnly(dialog);
        this.routeDialog(itemType, dialog);
    }

    protected createEntityDialog(itemType: string, callback?: (dlg: Widget<any>) => void): Widget<any> {
        var dialog = Widget.create({
            type: this.getDialogTypeFor(itemType),
            options: this.getDialogOptionsFor(itemType)
        });
        this.initEntityDialog(itemType, dialog);
        callback?.(dialog);
        return dialog;
    }

    protected getDialogOptions(): any {
        return {};
    }

    protected getDialogOptionsFor(itemType: string): any {
        if (itemType === this.getItemType())
            return this.getDialogOptions();

        return {};
    }

    protected getDialogTypeFor(itemType: string): { new(...args: any[]): Widget<any> } {

        if (itemType === this.getItemType()) {
            return this.getDialogType();
        }

        return DialogTypeRegistry.get(itemType) as any;
    }

    private _dialogType: any;

    protected getDialogType(): { new(...args: any[]): Widget<any> } {

        if (this._dialogType != null)
            return this._dialogType;

        var attr = this.attrs(DialogTypeAttribute);
        if (attr.length >= 1)
            this._dialogType = attr[0].value;
        else
            this._dialogType = DialogTypeRegistry.get(this.getEntityType());

        return this._dialogType;
    }
}