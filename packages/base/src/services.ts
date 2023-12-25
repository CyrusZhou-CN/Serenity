﻿import { Config } from "./config";

export function resolveUrl(url: string) {
    if (url != null && url.charAt(0) == '~' && url.charAt(1) == '/')
        return Config.applicationPath + url.substring(2);
    return url;
}

export function resolveServiceUrl(url: string) {
    if (url && url.length && url.charAt(0) != '~' && url.charAt(0) != '/' && url.indexOf('://') < 0)
        return resolveUrl("~/Services/") + url;

    return resolveUrl(url);
}