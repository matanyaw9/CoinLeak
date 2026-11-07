// The only bridge between the page and the app. Exposes `window.coinleak`
// with an allowlist of channels and events, nothing else from Electron.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CHANNELS, EVENTS, type CoinLeakBridge } from "@shared/ipc";

const channels = new Set<string>(CHANNELS);
const events = new Set<string>(EVENTS);

const bridge: CoinLeakBridge = {
  invoke: (channel, args) =>
    channels.has(channel) ? ipcRenderer.invoke(channel, args) : Promise.reject(new Error("unknown channel")),
  on: (event, listener) => {
    if (!events.has(event)) throw new Error("unknown event");
    const wrapped = (_e: IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
};

contextBridge.exposeInMainWorld("coinleak", bridge);
