import {
  SWARM,
  assertMediaFulfillmentEvidence,
  assertMediaTransportObservation,
  assertMaterializationBudget,
  type MediaFulfillmentEvidence,
  type MediaTransportObservation,
  type MaterializationBudget,
} from "../../constitute-protocol/src/index.js";

export type BrowserStreamSession = {
  sourceId: string;
  sessionId: string;
  fulfillmentSessionId: string;
  operationRef: string;
  operationClassRef: string;
  methodRef: string;
  frameId: string;
  correlationKeys: Set<string>;
  correlationBudget: MaterializationBudget;
  serviceAccepted: boolean;
  serviceRejected: boolean;
  answerReceived: boolean;
  candidateCount: number;
  healthStatus: string;
  routePending: boolean;
  routeState: string;
  adapterModuleRef: string;
  adapterBindingState: string;
  adapterBindingBlockedReason: string;
  transportProfileRefs: string[];
  renderEvidenceBudgetRef: string;
  releaseRefs: string[];
  adapterFailed: boolean;
  adapterFailureReason: string;
  adapterFailureNotified: boolean;
  iceConnectionState: string;
  connectionState: string;
  iceGatheringState: string;
  selectedIceServerCount: number;
  localCandidateCount: number;
  remoteCandidateCount: number;
  lastInboundBytesReceived: number;
  lastInboundPacketsReceived: number;
  lastInboundFramesDecoded: number;
  lastInboundAdvancedAt: number;
  inboundStalledSince: number;
  lastRenderCurrentTime: number;
  lastRenderAdvancedAt: number;
  renderPendingSince: number;
  mediaEvidenceBudget: Map<string, MediaEvidenceBudgetEntry>;
  mediaStatsTimer: number;
  issuedAt: number;
  expiresAt: number;
  pc: RTCPeerConnection;
  pendingRemoteCandidates: RTCIceCandidateInit[];
};

export type BrowserStreamAdapterState = {
  kind: "iceConnection" | "connection" | "iceGathering";
  state: string;
  failed: boolean;
  reason: string;
  observedAt: number;
};

export type BrowserStreamOffer = {
  session: BrowserStreamSession;
  nonce: string;
  sessionId: string;
  description: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
};

export type BrowserStreamAdapterOptions = {
  nonce: string;
  sessionId: string;
  fulfillmentSessionId: string;
  operationRef?: string;
  operationClassRef?: string;
  methodRef?: string;
  sourceId: string;
  moduleRef?: string;
  adapterBindingPosture?: SurfaceAdapterBindingPosture | null;
  iceServers?: RTCIceServer[];
  onCandidate?: (candidate: RTCIceCandidateInit) => void;
  onStateChange?: (state: BrowserStreamAdapterState, session: BrowserStreamSession) => void;
  onTrack?: (stream: unknown, track: MediaStreamTrack, session: BrowserStreamSession) => void;
};

export type RuntimeMediaTransportProfile = {
  kind?: string;
  profileId?: string;
  transport?: string;
  role?: string;
  selectedBy?: string;
  iceServers?: RTCIceServer[];
  issuedAt?: number;
  expiresAt?: number;
};

export type SurfaceAdapterBindingPosture = {
  kind?: string;
  state?: string;
  blockedReason?: string;
  blockedReasons?: readonly string[];
  role?: string;
  taxonomyKey?: string;
  moduleRef?: string;
  implementationRef?: string;
  participantSide?: string;
  primitiveRefs?: readonly string[];
  evidenceChannels?: readonly string[];
  lifecycle?: Record<string, unknown>;
  transportProfileRefs?: readonly string[];
  renderEvidenceBudgetRef?: string;
  materializationBudgetRefs?: readonly string[];
  releaseRefs?: readonly string[];
};

export type MediaWebRtcAdapterBindingProfile = {
  kind: "media.webrtc.adapter.binding.profile";
  state: string;
  blockedReason: string;
  blockedReasons: readonly string[];
  role: string;
  taxonomyKey: string;
  participantSide: string;
  contractModuleRef: string;
  implementationRef: string;
  adapterModuleRef: string;
  primitiveRefs: readonly string[];
  evidenceChannels: readonly string[];
  lifecycle: Readonly<Record<string, unknown>>;
  transportProfileRefs: readonly string[];
  renderEvidenceBudgetRef: string;
  materializationBudgetRefs: readonly string[];
  releaseRefs: readonly string[];
};

type MediaEvidenceBudgetEntry = {
  signature: string;
  emittedAt: number;
};

export const DEFAULT_BROWSER_STREAM_ICE_SERVERS: RTCIceServer[] = [];
export const BROWSER_STREAM_ADAPTER_REF = "adapter:media-webrtc:browser";
const MEDIA_CORRELATION_MATERIALIZATION_BUDGET_ID = "media-webrtc.correlation";
const MEDIA_CORRELATION_KEY_LIMIT = 4;
const INBOUND_RTP_STALL_GRACE_MS = 15_000;
export const MEDIA_RENDER_WAITING_GRACE_MS = 5_000;
export const MEDIA_RENDER_BLOCKED_GRACE_MS = 10_000;
const MEDIA_RENDER_CURRENT_TIME_EPSILON = 0.05;
const MEDIA_EVIDENCE_PENDING_HEARTBEAT_MS = 5_000;
const MEDIA_EVIDENCE_STABLE_HEARTBEAT_MS = 15_000;
const RUNTIME_MEDIA_TRANSPORT_PROFILE_GET = "runtime.media.transport.profile.get";

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function uniqueStrings(value: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export function mediaWebRtcAdapterBindingProfile(
  posture?: SurfaceAdapterBindingPosture | null,
  options: { moduleRef?: string } = {},
): MediaWebRtcAdapterBindingProfile {
  const binding = posture && typeof posture === "object" ? posture : {};
  const adapterModuleRef = firstString(
    options.moduleRef,
    binding.implementationRef,
    binding.moduleRef,
    BROWSER_STREAM_ADAPTER_REF,
  );
  const blockedReasons = uniqueStrings([
    binding.blockedReason,
    ...normalizeStringArray(binding.blockedReasons),
    ...(adapterModuleRef ? [] : ["missingAdapterModuleRef"]),
  ]);
  const declaredState = String(binding.state || "").trim();
  const state = blockedReasons.length
    ? "blocked"
    : (declaredState || (adapterModuleRef ? "ready" : "blocked"));
  return Object.freeze({
    kind: "media.webrtc.adapter.binding.profile",
    state,
    blockedReason: blockedReasons[0] || "",
    blockedReasons: Object.freeze(blockedReasons),
    role: firstString(binding.role, "platformAdapter"),
    taxonomyKey: firstString(binding.taxonomyKey, "platformAdapter"),
    participantSide: firstString(binding.participantSide, "window"),
    contractModuleRef: firstString(binding.moduleRef),
    implementationRef: firstString(binding.implementationRef),
    adapterModuleRef,
    primitiveRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.primitiveRefs),
      "media.transport.path",
    ])),
    evidenceChannels: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.evidenceChannels),
      "adapter.evidence",
      "media.transport.observation",
    ])),
    lifecycle: Object.freeze({
      state: "platformBinding",
      ...(binding.lifecycle && typeof binding.lifecycle === "object" ? binding.lifecycle : {}),
    }),
    transportProfileRefs: Object.freeze(normalizeStringArray(binding.transportProfileRefs)),
    renderEvidenceBudgetRef: firstString(binding.renderEvidenceBudgetRef),
    materializationBudgetRefs: Object.freeze(normalizeStringArray(binding.materializationBudgetRefs)),
    releaseRefs: Object.freeze(normalizeStringArray(binding.releaseRefs)),
  });
}

export function runtimeMediaIceServers(profile: RuntimeMediaTransportProfile | null): RTCIceServer[] {
  return Array.isArray(profile?.iceServers)
    ? profile.iceServers.filter((server): server is RTCIceServer => Boolean(server && typeof server === "object"))
    : [];
}

export function runtimeMediaIceServerUrls(profile: RuntimeMediaTransportProfile | null, scheme: "stun:" | "turn:"): string[] {
  const out: string[] = [];
  for (const server of runtimeMediaIceServers(profile)) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      const text = String(url || "").trim();
      if (text.startsWith(scheme) && !out.includes(text)) out.push(text);
    }
  }
  return out;
}

export function runtimeMediaTransportContract(profile: RuntimeMediaTransportProfile | null): Record<string, unknown> {
  if (!profile || typeof profile !== "object") return {};
  return {
    kind: String(profile.kind || "runtime.mediaTransport.profile").trim(),
    profileId: String(profile.profileId || "").trim(),
    transport: String(profile.transport || "webrtc").trim(),
    role: String(profile.role || "browserOfferer").trim(),
    selectedBy: String(profile.selectedBy || "runtime").trim(),
    iceServerCount: runtimeMediaIceServers(profile).length,
    issuedAt: Number(profile.issuedAt || 0) || undefined,
    expiresAt: Number(profile.expiresAt || 0) || undefined,
  };
}

export function runtimeMediaTransportBlockedDetail(error: unknown): string {
  const detail = String((error as Error)?.message || error || "profile unavailable").trim();
  return `Runtime media transport profile unavailable: ${detail}`;
}

export function isRuntimeMediaTransportProfileFailure(error: unknown): boolean {
  const detail = String((error as { detail?: unknown })?.detail || (error as Error)?.message || error || "").toLowerCase();
  return detail.includes(RUNTIME_MEDIA_TRANSPORT_PROFILE_GET)
    || detail.includes("runtime media transport profile unavailable")
    || detail.includes("media transport profile unavailable");
}

function selectedIceServerCount(iceServers: RTCIceServer[]): number {
  return iceServers.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => typeof url === "string" && url.trim());
  }).length;
}

export function browserStreamAvailable(): boolean {
  return typeof RTCPeerConnection === "function";
}

export type BrowserMediaStreamBindResult = {
  kind: "browser.mediaStream.bind";
  ok: boolean;
  state: "bound" | "playRequested" | "playFailed";
  reason?: string;
  autoplay: boolean;
  muted: boolean;
  playsInline: boolean;
  hasSrcObject: boolean;
};

export async function bindBrowserMediaStream(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<BrowserMediaStreamBindResult> {
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  if (video.srcObject !== stream) video.srcObject = stream;
  try {
    await video.play();
    return {
      kind: "browser.mediaStream.bind",
      ok: true,
      state: "playRequested",
      autoplay: video.autoplay,
      muted: video.muted,
      playsInline: video.playsInline,
      hasSrcObject: video.srcObject === stream,
    };
  } catch (error) {
    return {
      kind: "browser.mediaStream.bind",
      ok: false,
      state: "playFailed",
      reason: String((error as Error)?.message || error || "video playback request failed"),
      autoplay: video.autoplay,
      muted: video.muted,
      playsInline: video.playsInline,
      hasSrcObject: video.srcObject === stream,
    };
  }
}

function descriptionJson(description: RTCSessionDescription | RTCSessionDescriptionInit | null): RTCSessionDescriptionInit {
  if (!description) throw new Error("missing WebRTC session description");
  return {
    type: description.type,
    sdp: description.sdp || "",
  };
}

export function candidateJson(candidate: RTCIceCandidate): RTCIceCandidateInit {
  return candidate.toJSON();
}

export function candidateKey(candidate: RTCIceCandidateInit): string {
  return [
    candidate.candidate || "",
    candidate.sdpMid || "",
    candidate.sdpMLineIndex ?? "",
    candidate.usernameFragment || "",
  ].join("|");
}

function adapterFailureReason(kind: BrowserStreamAdapterState["kind"], state: string): string {
  if (kind === "iceConnection" && state === "failed") {
    return "WebRTC ICE failed after stream answer.";
  }
  if (kind === "connection" && state === "failed") {
    return "WebRTC peer connection failed after stream answer.";
  }
  if (state === "closed") {
    return "WebRTC adapter closed before live media attached.";
  }
  return "";
}

function recordAdapterState(
  session: BrowserStreamSession,
  kind: BrowserStreamAdapterState["kind"],
  state: string,
  onStateChange?: BrowserStreamAdapterOptions["onStateChange"],
): void {
  const normalized = String(state || "").trim();
  if (!normalized) return;
  if (kind === "iceConnection") session.iceConnectionState = normalized;
  if (kind === "connection") session.connectionState = normalized;
  if (kind === "iceGathering") session.iceGatheringState = normalized;
  const reason = adapterFailureReason(kind, normalized);
  const failed = Boolean(reason);
  if (failed) {
    session.adapterFailed = true;
    session.adapterFailureReason = reason;
  }
  onStateChange?.({
    kind,
    state: normalized,
    failed,
    reason,
    observedAt: Date.now(),
  }, session);
}

function mediaEvidenceId(session: BrowserStreamSession, evidenceKind: string): string {
  const source = [
    session.sessionId,
    evidenceKind,
    Date.now(),
    Math.random().toString(16).slice(2, 10),
  ].filter(Boolean).join(":");
  return `media-proof:${source}`;
}

function mediaEvidenceBase(
  session: BrowserStreamSession,
  evidenceKind: string,
  state: string,
  safeFacts: Record<string, unknown>,
  blockedReason = "",
): MediaFulfillmentEvidence {
  const evidenceSafeFacts = {
    ...safeFacts,
    adapterModuleRef: session.adapterModuleRef || BROWSER_STREAM_ADAPTER_REF,
    adapterBindingState: session.adapterBindingState,
    adapterBindingBlockedReason: session.adapterBindingBlockedReason,
    transportProfileRefs: session.transportProfileRefs,
    renderEvidenceBudgetRef: session.renderEvidenceBudgetRef,
    releaseRefs: session.releaseRefs,
  };
  const record = {
    kind: SWARM.RECORD_KIND.MEDIA_FULFILLMENT_EVIDENCE,
    evidenceId: mediaEvidenceId(session, evidenceKind),
    evidenceKind,
    state,
    fulfillmentSessionId: session.fulfillmentSessionId,
    sessionId: session.sessionId,
    ...(session.operationRef ? { operationRef: session.operationRef } : {}),
    ...(session.operationClassRef ? { operationClassRef: session.operationClassRef } : {}),
    ...(session.methodRef ? { methodRef: session.methodRef } : {}),
    correlationId: session.frameId || undefined,
    adapterRef: BROWSER_STREAM_ADAPTER_REF,
    sourceRef: session.sourceId,
    ...(blockedReason ? { blockedReason } : {}),
    safeFacts: evidenceSafeFacts,
    observedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };
  return assertMediaFulfillmentEvidence(record) as MediaFulfillmentEvidence;
}

function mediaObservationId(session: BrowserStreamSession, evidenceKind: string): string {
  return [
    "media-observation",
    session.sessionId,
    evidenceKind,
    Date.now(),
    Math.random().toString(16).slice(2, 10),
  ].filter(Boolean).join(":");
}

function mediaTransportPathId(session: BrowserStreamSession): string {
  return `media-path:${session.sessionId || session.sourceId || "browser-webrtc"}`;
}

function mediaCorrelationKeys(options: BrowserStreamAdapterOptions): Set<string> {
  const keys = new Set<string>();
  for (const value of [options.sessionId, options.fulfillmentSessionId, options.operationRef, options.nonce]) {
    const key = String(value || "").trim();
    if (!key || keys.size >= MEDIA_CORRELATION_KEY_LIMIT) continue;
    keys.add(key);
  }
  return keys;
}

function mediaCorrelationMaterializationBudget(
  keys: Set<string>,
  issuedAt = Date.now(),
  sourceAuthority = BROWSER_STREAM_ADAPTER_REF,
): MaterializationBudget {
  const overBudget = keys.size > MEDIA_CORRELATION_KEY_LIMIT;
  return assertMaterializationBudget({
    kind: SWARM.RECORD_KIND.MATERIALIZATION_BUDGET,
    budgetId: MEDIA_CORRELATION_MATERIALIZATION_BUDGET_ID,
    sourceAuthority: sourceAuthority || BROWSER_STREAM_ADAPTER_REF,
    consumerRef: "runtime.media.transport",
    payloadClass: SWARM.MATERIALIZATION_PAYLOAD_CLASS.EVIDENCE,
    copyRole: SWARM.MATERIALIZATION_COPY_ROLE.EVIDENCE,
    transferMode: SWARM.MATERIALIZATION_TRANSFER_MODE.REFERENCE_ONLY,
    privacyTier: SWARM.MATERIALIZATION_PRIVACY_TIER.SAFE_INDEX,
    state: overBudget ? SWARM.RESOURCE_POSTURE_STATE.PRESSURE : SWARM.RESOURCE_POSTURE_STATE.WITHIN_BUDGET,
    limits: {
      maxCorrelationKeys: MEDIA_CORRELATION_KEY_LIMIT,
      correlationKeyCount: keys.size,
    },
    snapshotPolicy: { mode: "bounded-correlation-refs" },
    deltaPolicy: { mode: "replace-with-session" },
    coalescing: { key: "sessionId" },
    cardinality: {
      maxSessionRefs: 1,
      maxNonceRefs: 1,
      rawValues: "excluded-from-safe-facts",
    },
    schema: {
      state: SWARM.MATERIALIZATION_SCHEMA_STATE.CURRENT,
      version: "media-webrtc.correlation.v1",
    },
    blockedReasons: overBudget ? ["mediaCorrelationKeyPressure"] : [],
    referenceRefs: ["media.transport.observation"],
    retentionClass: "ephemeral.media-evidence-index",
    issuedAt,
    releaseAfter: issuedAt,
    expiresAt: issuedAt + 60_000,
  }) as MaterializationBudget;
}

function mediaTransportObservationState(evidence: MediaFulfillmentEvidence): string {
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.USABLE) return SWARM.MEDIA_TRANSPORT_OBSERVATION_STATE.CONNECTED;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED) return SWARM.MEDIA_TRANSPORT_OBSERVATION_STATE.BLOCKED;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.RELEASED) return SWARM.MEDIA_TRANSPORT_OBSERVATION_STATE.RELEASED;
  return SWARM.MEDIA_TRANSPORT_OBSERVATION_STATE.PENDING;
}

function selectedPairStateFromEvidence(evidence: MediaFulfillmentEvidence): string | undefined {
  if (evidence.evidenceKind !== SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.SELECTED_CANDIDATE_PAIR) return undefined;
  const facts = evidence.safeFacts && typeof evidence.safeFacts === "object"
    ? evidence.safeFacts as Record<string, unknown>
    : {};
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED) return SWARM.MEDIA_TRANSPORT_SELECTED_PAIR_STATE.FAILED;
  return facts.selectedPair === true
    ? SWARM.MEDIA_TRANSPORT_SELECTED_PAIR_STATE.SELECTED
    : SWARM.MEDIA_TRANSPORT_SELECTED_PAIR_STATE.PENDING;
}

function inboundRtpStateFromEvidence(evidence: MediaFulfillmentEvidence): string | undefined {
  if (evidence.evidenceKind !== SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.INBOUND_STATS) return undefined;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED) return SWARM.MEDIA_TRANSPORT_RTP_STATE.STALLED;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.USABLE) return SWARM.MEDIA_TRANSPORT_RTP_STATE.FLOWING;
  return SWARM.MEDIA_TRANSPORT_RTP_STATE.PENDING;
}

function trackStateFromEvidence(evidence: MediaFulfillmentEvidence): string | undefined {
  if (evidence.evidenceKind !== SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRACK_STATE) return undefined;
  const facts = evidence.safeFacts && typeof evidence.safeFacts === "object"
    ? evidence.safeFacts as Record<string, unknown>
    : {};
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.RELEASED) return SWARM.MEDIA_TRANSPORT_TRACK_STATE.RELEASED;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED) return SWARM.MEDIA_TRANSPORT_TRACK_STATE.BLOCKED;
  if (String(facts.trackReadyState || "").trim() === "ended") return SWARM.MEDIA_TRANSPORT_TRACK_STATE.ENDED;
  if (facts.muted === true) return SWARM.MEDIA_TRANSPORT_TRACK_STATE.MUTED;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.USABLE) return SWARM.MEDIA_TRANSPORT_TRACK_STATE.LIVE;
  return SWARM.MEDIA_TRANSPORT_TRACK_STATE.PENDING;
}

function renderStateFromEvidence(evidence: MediaFulfillmentEvidence): string | undefined {
  if (evidence.evidenceKind !== SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.RENDER_STATE) return undefined;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED) return SWARM.MEDIA_TRANSPORT_RENDER_STATE.BLOCKED;
  if (evidence.state === SWARM.MEDIA_FULFILLMENT_STATE.USABLE) return SWARM.MEDIA_TRANSPORT_RENDER_STATE.VISIBLE;
  return SWARM.MEDIA_TRANSPORT_RENDER_STATE.PENDING;
}

export function mediaTransportObservationFromFulfillmentEvidence(
  session: BrowserStreamSession,
  evidence: MediaFulfillmentEvidence,
): MediaTransportObservation | null {
  const evidenceKind = String(evidence.evidenceKind || "").trim();
  if (![
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRANSPORT_STATE,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.SELECTED_CANDIDATE_PAIR,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.INBOUND_STATS,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRACK_STATE,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.RENDER_STATE,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.RELEASE,
  ].includes(evidenceKind)) {
    return null;
  }
  const observedAt = Number(evidence.observedAt || 0) || Date.now();
  const safeFacts = evidence.safeFacts && typeof evidence.safeFacts === "object"
    ? evidence.safeFacts as Record<string, unknown>
    : {};
  const record = {
    kind: SWARM.RECORD_KIND.MEDIA_TRANSPORT_OBSERVATION,
    observationId: mediaObservationId(session, evidenceKind || "transport"),
    pathId: mediaTransportPathId(session),
    sessionId: session.sessionId,
    fulfillmentSessionId: firstString(evidence.fulfillmentSessionId, session.fulfillmentSessionId),
    activationId: String(evidence.activationId || "").trim() || undefined,
    routePromiseId: String(evidence.routePromiseId || "").trim() || undefined,
    participantRef: BROWSER_STREAM_ADAPTER_REF,
    participantRole: SWARM.MEDIA_TRANSPORT_PARTICIPANT_ROLE.BROWSER,
    state: mediaTransportObservationState(evidence),
    connectionState: session.connectionState || undefined,
    iceConnectionState: session.iceConnectionState || undefined,
    selectedPairState: selectedPairStateFromEvidence(evidence),
    inboundRtpState: inboundRtpStateFromEvidence(evidence),
    trackState: trackStateFromEvidence(evidence),
    renderState: renderStateFromEvidence(evidence),
    blockedReason: String((evidence as MediaFulfillmentEvidence & { blockedReason?: string }).blockedReason || "").trim() || undefined,
    safeFacts: {
      evidenceKind,
      sourceRef: session.sourceId,
      iceGatheringState: session.iceGatheringState,
      localCandidateCount: session.localCandidateCount,
      remoteCandidateCount: session.remoteCandidateCount,
      selectedIceServerCount: session.selectedIceServerCount,
      correlationKeyCount: session.correlationKeys.size,
      correlationBudgetId: session.correlationBudget.budgetId,
      ...safeFacts,
    },
    evidenceRefs: [String(evidence.evidenceId || "").trim()].filter(Boolean),
    observedAt,
    expiresAt: Number(evidence.expiresAt || 0) || observedAt + 60_000,
  };
  return assertMediaTransportObservation(record) as MediaTransportObservation;
}

function mediaEvidenceBudgetFacts(evidence: MediaFulfillmentEvidence): Record<string, unknown> {
  return evidence.safeFacts && typeof evidence.safeFacts === "object"
    ? evidence.safeFacts as Record<string, unknown>
    : {};
}

function mediaEvidenceBudgetKey(evidence: MediaFulfillmentEvidence): string {
  return String(evidence.evidenceKind || "unknown").trim() || "unknown";
}

function mediaEvidenceBudgetSignature(evidence: MediaFulfillmentEvidence): string {
  const facts = mediaEvidenceBudgetFacts(evidence);
  const evidenceKind = mediaEvidenceBudgetKey(evidence);
  const blockedReason = String((evidence as MediaFulfillmentEvidence & { blockedReason?: string }).blockedReason || "").trim();
  const base = [
    evidenceKind,
    String(evidence.state || "").trim(),
    blockedReason,
  ];
  if (evidenceKind === SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.RENDER_STATE) {
    base.push(
      String(facts.readinessState || "").trim(),
      facts.visibleFrame === true ? "visible" : "hidden",
      Number(facts.videoWidth || 0) > 0 && Number(facts.videoHeight || 0) > 0 ? "nonzero" : "zero",
      facts.paused === true ? "paused" : "playing",
      facts.ended === true ? "ended" : "not-ended",
    );
  } else if (evidenceKind === SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.INBOUND_STATS) {
    base.push(
      Number(facts.inboundVideoCount || 0) > 0 ? "inbound" : "no-inbound",
      facts.advanced === true ? "advanced" : "not-advanced",
      Number(facts.stalledMs || 0) > 0 ? "stalling" : "not-stalling",
    );
  } else if (evidenceKind === SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.SELECTED_CANDIDATE_PAIR) {
    base.push(
      facts.selectedPair === true ? "selected" : "not-selected",
      String(facts.pairState || "").trim(),
      facts.nominated === true ? "nominated" : "not-nominated",
    );
  } else if (evidenceKind === SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRANSPORT_STATE) {
    base.push(
      String(facts.connectionState || "").trim(),
      String(facts.iceConnectionState || "").trim(),
      String(facts.iceGatheringState || "").trim(),
      String(facts.localCandidateCount || 0),
      String(facts.remoteCandidateCount || 0),
    );
  } else if (evidenceKind === SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRACK_STATE) {
    base.push(
      String(facts.trackReadyState || "").trim(),
      facts.muted === true ? "muted" : "unmuted",
      facts.enabled === false ? "disabled" : "enabled",
    );
  }
  return base.join("|");
}

export function shouldReportMediaFulfillmentEvidence(
  session: BrowserStreamSession,
  evidence: MediaFulfillmentEvidence,
  observedAt = Date.now(),
): boolean {
  if (!session.mediaEvidenceBudget) {
    session.mediaEvidenceBudget = new Map<string, MediaEvidenceBudgetEntry>();
  }
  const key = mediaEvidenceBudgetKey(evidence);
  const signature = mediaEvidenceBudgetSignature(evidence);
  const state = String(evidence.state || "").trim();
  const previous = session.mediaEvidenceBudget.get(key);
  const mustReport = state === SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED
    || state === SWARM.MEDIA_FULFILLMENT_STATE.RELEASED
    || !previous
    || previous.signature !== signature;
  const heartbeatMs = state === SWARM.MEDIA_FULFILLMENT_STATE.USABLE
    ? MEDIA_EVIDENCE_STABLE_HEARTBEAT_MS
    : MEDIA_EVIDENCE_PENDING_HEARTBEAT_MS;
  const heartbeatDue = previous
    ? observedAt - previous.emittedAt >= heartbeatMs
    : true;
  if (!mustReport && !heartbeatDue) return false;
  session.mediaEvidenceBudget.set(key, { signature, emittedAt: observedAt });
  return true;
}

export function mediaFulfillmentEvidenceFromAdapterState(
  session: BrowserStreamSession,
  state: BrowserStreamAdapterState,
): MediaFulfillmentEvidence {
  const evidenceState = state.state === "closed"
    ? SWARM.MEDIA_FULFILLMENT_STATE.RELEASED
    : state.failed
      ? SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED
      : ["connected", "completed"].includes(state.state)
        ? SWARM.MEDIA_FULFILLMENT_STATE.USABLE
        : SWARM.MEDIA_FULFILLMENT_STATE.PENDING;
  const blockedReason = state.failed
    ? state.reason
      .replace(/\.$/, "")
      .replace(/[^A-Za-z0-9]+(.)/g, (_match, next) => String(next || "").toUpperCase())
      .replace(/^./, (first) => first.toLowerCase()) || "mediaTransportFailed"
    : "";
  return mediaEvidenceBase(
    session,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRANSPORT_STATE,
    evidenceState,
    {
      stateKind: state.kind,
      state: state.state,
      iceConnectionState: session.iceConnectionState,
      connectionState: session.connectionState,
      iceGatheringState: session.iceGatheringState,
      selectedIceServerCount: session.selectedIceServerCount,
      localCandidateCount: session.localCandidateCount,
      remoteCandidateCount: session.remoteCandidateCount,
    },
    blockedReason,
  );
}

export function mediaFulfillmentEvidenceFromTrack(
  session: BrowserStreamSession,
  track: MediaStreamTrack,
): MediaFulfillmentEvidence {
  const blocked = track.readyState === "ended";
  const usable = track.readyState === "live" && !track.muted;
  return mediaEvidenceBase(
    session,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.TRACK_STATE,
    blocked
      ? SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED
      : usable
        ? SWARM.MEDIA_FULFILLMENT_STATE.USABLE
        : SWARM.MEDIA_FULFILLMENT_STATE.PENDING,
    {
      trackKind: track.kind,
      trackReadyState: track.readyState,
      muted: track.muted,
      enabled: track.enabled,
    },
    blocked ? "trackEnded" : "",
  );
}

export function mediaFulfillmentEvidenceFromRender(
  session: BrowserStreamSession,
  video: HTMLVideoElement,
): MediaFulfillmentEvidence {
  const observedAt = Date.now();
  const visibleFrame = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
  const currentTime = Number(video.currentTime || 0) || 0;
  const previousCurrentTime = Number(session.lastRenderCurrentTime || 0) || 0;
  const playbackAdvanced = visibleFrame
    && (currentTime > previousCurrentTime + MEDIA_RENDER_CURRENT_TIME_EPSILON
      || (previousCurrentTime <= 0 && currentTime > MEDIA_RENDER_CURRENT_TIME_EPSILON));
  if (playbackAdvanced) {
    session.lastRenderAdvancedAt = observedAt;
    session.renderPendingSince = 0;
  } else if (!session.renderPendingSince) {
    session.renderPendingSince = observedAt;
  }
  session.lastRenderCurrentTime = Math.max(previousCurrentTime, currentTime);
  const renderPendingMs = session.renderPendingSince > 0 ? observedAt - session.renderPendingSince : 0;
  const readinessState = playbackAdvanced
    ? "renderVisible"
    : renderPendingMs >= MEDIA_RENDER_BLOCKED_GRACE_MS
      ? "renderBlocked"
      : renderPendingMs >= MEDIA_RENDER_WAITING_GRACE_MS
        ? "waitingRender"
        : "pendingRender";
  const blockedReason = video.error
    ? "videoElementError"
    : renderPendingMs >= MEDIA_RENDER_BLOCKED_GRACE_MS
      ? visibleFrame
        ? "renderPlaybackStalled"
        : "renderDimensionsMissing"
      : "";
  const blocked = Boolean(video.error) || Boolean(blockedReason);
  return mediaEvidenceBase(
    session,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.RENDER_STATE,
    blocked
      ? SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED
      : playbackAdvanced
        ? SWARM.MEDIA_FULFILLMENT_STATE.USABLE
        : SWARM.MEDIA_FULFILLMENT_STATE.PENDING,
    {
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentTime,
      previousCurrentTime,
      paused: video.paused,
      ended: video.ended,
      visibleFrame,
      playbackAdvanced,
      renderPendingMs,
      readinessState,
      lastRenderAdvancedAt: session.lastRenderAdvancedAt || 0,
    },
    blockedReason,
  );
}

export function mediaFulfillmentReleaseEvidence(
  session: BrowserStreamSession,
  reason = "adapterReleased",
): MediaFulfillmentEvidence {
  return mediaEvidenceBase(
    session,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.RELEASE,
    SWARM.MEDIA_FULFILLMENT_STATE.RELEASED,
    {
      reason,
      iceConnectionState: session.iceConnectionState,
      connectionState: session.connectionState,
    },
  );
}

export async function collectBrowserMediaFulfillmentEvidence(session: BrowserStreamSession): Promise<MediaFulfillmentEvidence[]> {
  const stats = await session.pc.getStats().catch(() => null);
  if (!stats) return [];
  const observedAt = Date.now();
  let selectedPair: RTCStats | null = null;
  let inboundVideoCount = 0;
  let inboundBytesReceived = 0;
  let inboundPacketsReceived = 0;
  let inboundFramesDecoded = 0;
  stats.forEach((report) => {
    const item = report as RTCStats & Record<string, unknown>;
    if (item.type === "candidate-pair" && (item.selected === true || item.nominated === true)) {
      selectedPair = item;
    }
    if (item.type === "inbound-rtp" && item.kind === "video") {
      inboundVideoCount += 1;
      inboundBytesReceived += Number(item.bytesReceived || 0);
      inboundPacketsReceived += Number(item.packetsReceived || 0);
      inboundFramesDecoded += Number(item.framesDecoded || 0);
    }
  });
  const previousBytes = Number(session.lastInboundBytesReceived || 0);
  const previousPackets = Number(session.lastInboundPacketsReceived || 0);
  const previousFrames = Number(session.lastInboundFramesDecoded || 0);
  const statsReset = inboundBytesReceived < previousBytes || inboundFramesDecoded < previousFrames;
  const advanced = statsReset
    || inboundBytesReceived > previousBytes
    || inboundPacketsReceived > previousPackets
    || inboundFramesDecoded > previousFrames;
  const hasInbound = inboundBytesReceived > 0 || inboundPacketsReceived > 0 || inboundFramesDecoded > 0;
  if (advanced) {
    session.lastInboundAdvancedAt = observedAt;
    session.inboundStalledSince = 0;
  } else if (hasInbound && session.lastInboundAdvancedAt > 0 && !session.inboundStalledSince) {
    session.inboundStalledSince = observedAt;
  }
  session.lastInboundBytesReceived = inboundBytesReceived;
  session.lastInboundPacketsReceived = inboundPacketsReceived;
  session.lastInboundFramesDecoded = inboundFramesDecoded;
  const stalledMs = session.inboundStalledSince > 0 ? observedAt - session.inboundStalledSince : 0;
  const inboundBlocked = hasInbound && stalledMs >= INBOUND_RTP_STALL_GRACE_MS;
  const inboundState = inboundBlocked
    ? SWARM.MEDIA_FULFILLMENT_STATE.BLOCKED
    : hasInbound && advanced
      ? SWARM.MEDIA_FULFILLMENT_STATE.USABLE
      : SWARM.MEDIA_FULFILLMENT_STATE.PENDING;
  const out: MediaFulfillmentEvidence[] = [];
  out.push(mediaEvidenceBase(
    session,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.SELECTED_CANDIDATE_PAIR,
    selectedPair ? SWARM.MEDIA_FULFILLMENT_STATE.USABLE : SWARM.MEDIA_FULFILLMENT_STATE.PENDING,
    {
      selectedPair: Boolean(selectedPair),
      pairState: String((selectedPair as Record<string, unknown> | null)?.state || ""),
      nominated: Boolean((selectedPair as Record<string, unknown> | null)?.nominated),
    },
  ));
  out.push(mediaEvidenceBase(
    session,
    SWARM.MEDIA_FULFILLMENT_EVIDENCE_KIND.INBOUND_STATS,
    inboundState,
    {
      inboundVideoCount,
      inboundBytesReceived,
      inboundPacketsReceived,
      inboundFramesDecoded,
      deltaBytesReceived: statsReset ? inboundBytesReceived : inboundBytesReceived - previousBytes,
      deltaPacketsReceived: statsReset ? inboundPacketsReceived : inboundPacketsReceived - previousPackets,
      deltaFramesDecoded: statsReset ? inboundFramesDecoded : inboundFramesDecoded - previousFrames,
      advanced,
      stalledMs,
    },
    inboundBlocked ? "inboundRtpStalled" : "",
  ));
  return out;
}

async function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 5_000): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(done, timeoutMs);
    function done(): void {
      window.clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onState);
      resolve();
    }
    function onState(): void {
      if (pc.iceGatheringState === "complete") done();
    }
    pc.addEventListener("icegatheringstatechange", onState);
  });
}

export async function createBrowserStreamOffer(options: BrowserStreamAdapterOptions): Promise<BrowserStreamOffer> {
  if (!browserStreamAvailable()) {
    throw new Error("browser stream transport is unavailable in this context");
  }
  const selectedIceServers = options.iceServers || DEFAULT_BROWSER_STREAM_ICE_SERVERS;
  const pc = new RTCPeerConnection({
    iceServers: selectedIceServers,
  });
  const issuedAt = Date.now();
  const correlationKeys = mediaCorrelationKeys(options);
  const adapterBinding = mediaWebRtcAdapterBindingProfile(options.adapterBindingPosture, {
    moduleRef: options.moduleRef,
  });
  const fulfillmentSessionId = firstString(options.fulfillmentSessionId);
  if (!fulfillmentSessionId) {
    throw new Error("browser stream offer requires runtime-prepared fulfillmentSessionId");
  }
  const operationRef = firstString(options.operationRef);
  const operationClassRef = firstString(options.operationClassRef);
  const methodRef = firstString(options.methodRef);
  const candidates: RTCIceCandidateInit[] = [];
  const session: BrowserStreamSession = {
    sourceId: options.sourceId,
    sessionId: options.sessionId,
    fulfillmentSessionId,
    operationRef,
    operationClassRef,
    methodRef,
    frameId: "",
    correlationKeys,
    correlationBudget: mediaCorrelationMaterializationBudget(correlationKeys, issuedAt, adapterBinding.adapterModuleRef),
    serviceAccepted: false,
    serviceRejected: false,
    answerReceived: false,
    candidateCount: 0,
    healthStatus: "",
    routePending: false,
    routeState: "",
    adapterModuleRef: adapterBinding.adapterModuleRef,
    adapterBindingState: adapterBinding.state,
    adapterBindingBlockedReason: adapterBinding.blockedReason,
    transportProfileRefs: [...adapterBinding.transportProfileRefs],
    renderEvidenceBudgetRef: adapterBinding.renderEvidenceBudgetRef,
    releaseRefs: [...adapterBinding.releaseRefs],
    adapterFailed: false,
    adapterFailureReason: "",
    adapterFailureNotified: false,
    iceConnectionState: pc.iceConnectionState || "",
    connectionState: pc.connectionState || "",
    iceGatheringState: pc.iceGatheringState || "",
    selectedIceServerCount: selectedIceServerCount(selectedIceServers),
    localCandidateCount: 0,
    remoteCandidateCount: 0,
    lastInboundBytesReceived: 0,
    lastInboundPacketsReceived: 0,
    lastInboundFramesDecoded: 0,
    lastInboundAdvancedAt: 0,
    inboundStalledSince: 0,
    lastRenderCurrentTime: 0,
    lastRenderAdvancedAt: 0,
    renderPendingSince: 0,
    mediaEvidenceBudget: new Map<string, MediaEvidenceBudgetEntry>(),
    mediaStatsTimer: 0,
    issuedAt,
    expiresAt: issuedAt + (2 * 60_000),
    pc,
    pendingRemoteCandidates: [],
  };
  pc.addEventListener("iceconnectionstatechange", () => {
    recordAdapterState(session, "iceConnection", pc.iceConnectionState, options.onStateChange);
  });
  pc.addEventListener("connectionstatechange", () => {
    recordAdapterState(session, "connection", pc.connectionState, options.onStateChange);
  });
  pc.addEventListener("icegatheringstatechange", () => {
    recordAdapterState(session, "iceGathering", pc.iceGatheringState, options.onStateChange);
  });
  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    const candidate = candidateJson(event.candidate);
    if (!String(candidate.candidate || "").trim()) return;
    candidates.push(candidate);
    session.localCandidateCount = candidates.length;
    options.onCandidate?.(candidate);
  };
  pc.ontrack = (event) => {
    const stream = event.streams?.[0] || new MediaStream([event.track]);
    options.onTrack?.(stream, event.track, session);
  };
  pc.addTransceiver("video", { direction: "recvonly" });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  return {
    session,
    nonce: options.nonce,
    sessionId: options.sessionId,
    description: descriptionJson(pc.localDescription || offer),
    candidates: candidates.slice(),
  };
}

export async function applyBrowserStreamAnswer(session: BrowserStreamSession, description: RTCSessionDescriptionInit): Promise<void> {
  await session.pc.setRemoteDescription(description);
  const pending = session.pendingRemoteCandidates.splice(0);
  for (const candidate of pending) {
    await session.pc.addIceCandidate(candidate).catch(() => {});
  }
}

export async function applyBrowserStreamCandidate(session: BrowserStreamSession, candidate: RTCIceCandidateInit): Promise<void> {
  if (session.pc.remoteDescription) {
    await session.pc.addIceCandidate(candidate).catch(() => {});
  } else {
    session.pendingRemoteCandidates.push(candidate);
  }
  session.remoteCandidateCount += 1;
  session.candidateCount = session.remoteCandidateCount;
}

export function closeBrowserStreamSession(session: BrowserStreamSession): void {
  if (session.mediaStatsTimer) {
    window.clearInterval(session.mediaStatsTimer);
    session.mediaStatsTimer = 0;
  }
  session.pc.close();
}
