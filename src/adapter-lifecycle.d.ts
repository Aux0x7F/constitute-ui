import type { SurfaceAdapterLifecyclePosture } from "../../constitute-protocol/src/index.js";

export function adapterReconnectJitterMs(baseMs: number, random?: () => number): number;
export function adapterReconnectDelayMs(attempt: number, baseMs: number, maxMs: number, jitterMs?: number): number;

export function surfaceAdapterLifecyclePosture(input?: Record<string, unknown>): SurfaceAdapterLifecyclePosture;
export function adapterReconnectLifecyclePosture(input?: Record<string, unknown>): SurfaceAdapterLifecyclePosture;
export function adapterReleaseLifecyclePosture(input?: Record<string, unknown>): SurfaceAdapterLifecyclePosture;
