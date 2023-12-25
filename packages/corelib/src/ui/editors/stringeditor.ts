﻿import { Decorators } from "../../decorators";
import { IStringValue } from "../../interfaces";
import { EditorWidget } from "../widgets/widget";

@Decorators.registerEditor('Serenity.StringEditor', [IStringValue])
@Decorators.element("<input type=\"text\"/>")
export class StringEditor<P={}> extends EditorWidget<P> {

    public get value(): string {
        return this.element.val() as string;
    }

    protected get_value(): string {
        return this.value;
    }

    public set value(value: string) {
        this.element.val(value);
    }

    protected set_value(value: string): void {
        this.value = value;
    }
}
