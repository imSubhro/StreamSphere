(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[turbopack]/browser/dev/hmr-client/hmr-client.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/// <reference path="../../../shared/runtime-types.d.ts" />
/// <reference path="../../runtime/base/dev-globals.d.ts" />
/// <reference path="../../runtime/base/dev-protocol.d.ts" />
/// <reference path="../../runtime/base/dev-extensions.ts" />
__turbopack_context__.s([
    "connect",
    ()=>connect,
    "setHooks",
    ()=>setHooks,
    "subscribeToUpdate",
    ()=>subscribeToUpdate
]);
function connect({ addMessageListener, sendMessage, onUpdateError = console.error }) {
    addMessageListener((msg)=>{
        switch(msg.type){
            case 'turbopack-connected':
                handleSocketConnected(sendMessage);
                break;
            default:
                try {
                    if (Array.isArray(msg.data)) {
                        for(let i = 0; i < msg.data.length; i++){
                            handleSocketMessage(msg.data[i]);
                        }
                    } else {
                        handleSocketMessage(msg.data);
                    }
                    applyAggregatedUpdates();
                } catch (e) {
                    console.warn('[Fast Refresh] performing full reload\n\n' + "Fast Refresh will perform a full reload when you edit a file that's imported by modules outside of the React rendering tree.\n" + 'You might have a file which exports a React component but also exports a value that is imported by a non-React component file.\n' + 'Consider migrating the non-React component export to a separate file and importing it into both files.\n\n' + 'It is also possible the parent component of the component you edited is a class component, which disables Fast Refresh.\n' + 'Fast Refresh requires at least one parent function component in your React tree.');
                    onUpdateError(e);
                    location.reload();
                }
                break;
        }
    });
    const queued = globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS;
    if (queued != null && !Array.isArray(queued)) {
        throw new Error('A separate HMR handler was already registered');
    }
    globalThis.TURBOPACK_CHUNK_UPDATE_LISTENERS = {
        push: ([chunkPath, callback])=>{
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    };
    if (Array.isArray(queued)) {
        for (const [chunkPath, callback] of queued){
            subscribeToChunkUpdate(chunkPath, sendMessage, callback);
        }
    }
}
const updateCallbackSets = new Map();
function sendJSON(sendMessage, message) {
    sendMessage(JSON.stringify(message));
}
function resourceKey(resource) {
    return JSON.stringify({
        path: resource.path,
        headers: resource.headers || null
    });
}
function subscribeToUpdates(sendMessage, resource) {
    sendJSON(sendMessage, {
        type: 'turbopack-subscribe',
        ...resource
    });
    return ()=>{
        sendJSON(sendMessage, {
            type: 'turbopack-unsubscribe',
            ...resource
        });
    };
}
function handleSocketConnected(sendMessage) {
    for (const key of updateCallbackSets.keys()){
        subscribeToUpdates(sendMessage, JSON.parse(key));
    }
}
// we aggregate all pending updates until the issues are resolved
const chunkListsWithPendingUpdates = new Map();
function aggregateUpdates(msg) {
    const key = resourceKey(msg.resource);
    let aggregated = chunkListsWithPendingUpdates.get(key);
    if (aggregated) {
        aggregated.instruction = mergeChunkListUpdates(aggregated.instruction, msg.instruction);
    } else {
        chunkListsWithPendingUpdates.set(key, msg);
    }
}
function applyAggregatedUpdates() {
    if (chunkListsWithPendingUpdates.size === 0) return;
    hooks.beforeRefresh();
    for (const msg of chunkListsWithPendingUpdates.values()){
        triggerUpdate(msg);
    }
    chunkListsWithPendingUpdates.clear();
    finalizeUpdate();
}
function mergeChunkListUpdates(updateA, updateB) {
    let chunks;
    if (updateA.chunks != null) {
        if (updateB.chunks == null) {
            chunks = updateA.chunks;
        } else {
            chunks = mergeChunkListChunks(updateA.chunks, updateB.chunks);
        }
    } else if (updateB.chunks != null) {
        chunks = updateB.chunks;
    }
    let merged;
    if (updateA.merged != null) {
        if (updateB.merged == null) {
            merged = updateA.merged;
        } else {
            // Since `merged` is an array of updates, we need to merge them all into
            // one, consistent update.
            // Since there can only be `EcmascriptMergeUpdates` in the array, there is
            // no need to key on the `type` field.
            let update = updateA.merged[0];
            for(let i = 1; i < updateA.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateA.merged[i]);
            }
            for(let i = 0; i < updateB.merged.length; i++){
                update = mergeChunkListEcmascriptMergedUpdates(update, updateB.merged[i]);
            }
            merged = [
                update
            ];
        }
    } else if (updateB.merged != null) {
        merged = updateB.merged;
    }
    return {
        type: 'ChunkListUpdate',
        chunks,
        merged
    };
}
function mergeChunkListChunks(chunksA, chunksB) {
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    return chunks;
}
function mergeChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted' || updateA.type === 'deleted' && updateB.type === 'added') {
        return undefined;
    }
    if (updateA.type === 'partial') {
        invariant(updateA.instruction, 'Partial updates are unsupported');
    }
    if (updateB.type === 'partial') {
        invariant(updateB.instruction, 'Partial updates are unsupported');
    }
    return undefined;
}
function mergeChunkListEcmascriptMergedUpdates(mergedA, mergedB) {
    const entries = mergeEcmascriptChunkEntries(mergedA.entries, mergedB.entries);
    const chunks = mergeEcmascriptChunksUpdates(mergedA.chunks, mergedB.chunks);
    return {
        type: 'EcmascriptMergedUpdate',
        entries,
        chunks
    };
}
function mergeEcmascriptChunkEntries(entriesA, entriesB) {
    return {
        ...entriesA,
        ...entriesB
    };
}
function mergeEcmascriptChunksUpdates(chunksA, chunksB) {
    if (chunksA == null) {
        return chunksB;
    }
    if (chunksB == null) {
        return chunksA;
    }
    const chunks = {};
    for (const [chunkPath, chunkUpdateA] of Object.entries(chunksA)){
        const chunkUpdateB = chunksB[chunkPath];
        if (chunkUpdateB != null) {
            const mergedUpdate = mergeEcmascriptChunkUpdates(chunkUpdateA, chunkUpdateB);
            if (mergedUpdate != null) {
                chunks[chunkPath] = mergedUpdate;
            }
        } else {
            chunks[chunkPath] = chunkUpdateA;
        }
    }
    for (const [chunkPath, chunkUpdateB] of Object.entries(chunksB)){
        if (chunks[chunkPath] == null) {
            chunks[chunkPath] = chunkUpdateB;
        }
    }
    if (Object.keys(chunks).length === 0) {
        return undefined;
    }
    return chunks;
}
function mergeEcmascriptChunkUpdates(updateA, updateB) {
    if (updateA.type === 'added' && updateB.type === 'deleted') {
        // These two completely cancel each other out.
        return undefined;
    }
    if (updateA.type === 'deleted' && updateB.type === 'added') {
        const added = [];
        const deleted = [];
        const deletedModules = new Set(updateA.modules ?? []);
        const addedModules = new Set(updateB.modules ?? []);
        for (const moduleId of addedModules){
            if (!deletedModules.has(moduleId)) {
                added.push(moduleId);
            }
        }
        for (const moduleId of deletedModules){
            if (!addedModules.has(moduleId)) {
                deleted.push(moduleId);
            }
        }
        if (added.length === 0 && deleted.length === 0) {
            return undefined;
        }
        return {
            type: 'partial',
            added,
            deleted
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'partial') {
        const added = new Set([
            ...updateA.added ?? [],
            ...updateB.added ?? []
        ]);
        const deleted = new Set([
            ...updateA.deleted ?? [],
            ...updateB.deleted ?? []
        ]);
        if (updateB.added != null) {
            for (const moduleId of updateB.added){
                deleted.delete(moduleId);
            }
        }
        if (updateB.deleted != null) {
            for (const moduleId of updateB.deleted){
                added.delete(moduleId);
            }
        }
        return {
            type: 'partial',
            added: [
                ...added
            ],
            deleted: [
                ...deleted
            ]
        };
    }
    if (updateA.type === 'added' && updateB.type === 'partial') {
        const modules = new Set([
            ...updateA.modules ?? [],
            ...updateB.added ?? []
        ]);
        for (const moduleId of updateB.deleted ?? []){
            modules.delete(moduleId);
        }
        return {
            type: 'added',
            modules: [
                ...modules
            ]
        };
    }
    if (updateA.type === 'partial' && updateB.type === 'deleted') {
        // We could eagerly return `updateB` here, but this would potentially be
        // incorrect if `updateA` has added modules.
        const modules = new Set(updateB.modules ?? []);
        if (updateA.added != null) {
            for (const moduleId of updateA.added){
                modules.delete(moduleId);
            }
        }
        return {
            type: 'deleted',
            modules: [
                ...modules
            ]
        };
    }
    // Any other update combination is invalid.
    return undefined;
}
function invariant(_, message) {
    throw new Error(`Invariant: ${message}`);
}
const CRITICAL = [
    'bug',
    'error',
    'fatal'
];
function compareByList(list, a, b) {
    const aI = list.indexOf(a) + 1 || list.length;
    const bI = list.indexOf(b) + 1 || list.length;
    return aI - bI;
}
const chunksWithIssues = new Map();
function emitIssues() {
    const issues = [];
    const deduplicationSet = new Set();
    for (const [_, chunkIssues] of chunksWithIssues){
        for (const chunkIssue of chunkIssues){
            if (deduplicationSet.has(chunkIssue.formatted)) continue;
            issues.push(chunkIssue);
            deduplicationSet.add(chunkIssue.formatted);
        }
    }
    sortIssues(issues);
    hooks.issues(issues);
}
function handleIssues(msg) {
    const key = resourceKey(msg.resource);
    let hasCriticalIssues = false;
    for (const issue of msg.issues){
        if (CRITICAL.includes(issue.severity)) {
            hasCriticalIssues = true;
        }
    }
    if (msg.issues.length > 0) {
        chunksWithIssues.set(key, msg.issues);
    } else if (chunksWithIssues.has(key)) {
        chunksWithIssues.delete(key);
    }
    emitIssues();
    return hasCriticalIssues;
}
const SEVERITY_ORDER = [
    'bug',
    'fatal',
    'error',
    'warning',
    'info',
    'log'
];
const CATEGORY_ORDER = [
    'parse',
    'resolve',
    'code generation',
    'rendering',
    'typescript',
    'other'
];
function sortIssues(issues) {
    issues.sort((a, b)=>{
        const first = compareByList(SEVERITY_ORDER, a.severity, b.severity);
        if (first !== 0) return first;
        return compareByList(CATEGORY_ORDER, a.category, b.category);
    });
}
const hooks = {
    beforeRefresh: ()=>{},
    refresh: ()=>{},
    buildOk: ()=>{},
    issues: (_issues)=>{}
};
function setHooks(newHooks) {
    Object.assign(hooks, newHooks);
}
function handleSocketMessage(msg) {
    sortIssues(msg.issues);
    handleIssues(msg);
    switch(msg.type){
        case 'issues':
            break;
        case 'partial':
            // aggregate updates
            aggregateUpdates(msg);
            break;
        default:
            // run single update
            const runHooks = chunkListsWithPendingUpdates.size === 0;
            if (runHooks) hooks.beforeRefresh();
            triggerUpdate(msg);
            if (runHooks) finalizeUpdate();
            break;
    }
}
function finalizeUpdate() {
    hooks.refresh();
    hooks.buildOk();
    // This is used by the Next.js integration test suite to notify it when HMR
    // updates have been completed.
    // TODO: Only run this in test environments (gate by `process.env.__NEXT_TEST_MODE`)
    if (globalThis.__NEXT_HMR_CB) {
        globalThis.__NEXT_HMR_CB();
        globalThis.__NEXT_HMR_CB = null;
    }
}
function subscribeToChunkUpdate(chunkListPath, sendMessage, callback) {
    return subscribeToUpdate({
        path: chunkListPath
    }, sendMessage, callback);
}
function subscribeToUpdate(resource, sendMessage, callback) {
    const key = resourceKey(resource);
    let callbackSet;
    const existingCallbackSet = updateCallbackSets.get(key);
    if (!existingCallbackSet) {
        callbackSet = {
            callbacks: new Set([
                callback
            ]),
            unsubscribe: subscribeToUpdates(sendMessage, resource)
        };
        updateCallbackSets.set(key, callbackSet);
    } else {
        existingCallbackSet.callbacks.add(callback);
        callbackSet = existingCallbackSet;
    }
    return ()=>{
        callbackSet.callbacks.delete(callback);
        if (callbackSet.callbacks.size === 0) {
            callbackSet.unsubscribe();
            updateCallbackSets.delete(key);
        }
    };
}
function triggerUpdate(msg) {
    const key = resourceKey(msg.resource);
    const callbackSet = updateCallbackSets.get(key);
    if (!callbackSet) {
        return;
    }
    for (const callback of callbackSet.callbacks){
        callback(msg);
    }
    if (msg.type === 'notFound') {
        // This indicates that the resource which we subscribed to either does not exist or
        // has been deleted. In either case, we should clear all update callbacks, so if a
        // new subscription is created for the same resource, it will send a new "subscribe"
        // message to the server.
        // No need to send an "unsubscribe" message to the server, it will have already
        // dropped the update stream before sending the "notFound" message.
        updateCallbackSets.delete(key);
    }
}
}),
"[project]/src/context/AuthContext.tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/router.js [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["createContext"])({});
const AuthProvider = ({ children })=>{
    _s();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [token, setToken] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            if (storedToken && storedUser) {
                setToken(storedToken);
                try {
                    setUser(JSON.parse(storedUser));
                } catch  {
                    localStorage.removeItem('user');
                }
            }
            setLoading(false);
        }
    }["AuthProvider.useEffect"], []);
    const login = (newToken, userData)=>{
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
        router.push('/dashboard');
    };
    const logout = ()=>{
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        router.push('/login');
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            user,
            token,
            login,
            logout,
            loading
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/context/AuthContext.tsx",
        lineNumber: 53,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0));
};
_s(AuthProvider, "PbNA1f39UoOYe1R45Fy24SktfoU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = AuthProvider;
const useAuth = ()=>{
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
};
_s1(useAuth, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/api.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "apiClient",
    ()=>apiClient,
    "createMeeting",
    ()=>createMeeting,
    "getCurrentUser",
    ()=>getCurrentUser,
    "getMeeting",
    ()=>getMeeting,
    "joinMeetingAPI",
    ()=>joinMeetingAPI,
    "leaveMeetingAPI",
    ()=>leaveMeetingAPI,
    "listMeetings",
    ()=>listMeetings,
    "loginUser",
    ()=>loginUser,
    "registerUser",
    ()=>registerUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/axios/lib/axios.js [client] (ecmascript)");
;
const API_URL = ("TURBOPACK compile-time value", "http://localhost:5000/api") || 'http://localhost:5000/api';
const apiClient = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$axios$2f$lib$2f$axios$2e$js__$5b$client$5d$__$28$ecmascript$29$__["default"].create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});
// Attach auth token to every request
apiClient.interceptors.request.use((config)=>{
    if ("TURBOPACK compile-time truthy", 1) {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});
// Auto-logout on 401/403
apiClient.interceptors.response.use((response)=>response, (error)=>{
    if (error.response?.status === 401 || error.response?.status === 403) {
        if ("TURBOPACK compile-time truthy", 1) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    return Promise.reject(error);
});
async function registerUser(data) {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
}
async function loginUser(data) {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
}
async function getCurrentUser() {
    const res = await apiClient.get('/auth/me');
    return res.data;
}
async function createMeeting(title) {
    const res = await apiClient.post('/meetings', {
        title
    });
    return res.data;
}
async function getMeeting(code) {
    const res = await apiClient.get(`/meetings/${code}`);
    return res.data;
}
async function listMeetings() {
    const res = await apiClient.get('/meetings');
    return res.data;
}
async function joinMeetingAPI(code) {
    const res = await apiClient.post(`/meetings/${code}/join`);
    return res.data;
}
async function leaveMeetingAPI(code) {
    try {
        const res = await apiClient.post(`/meetings/${code}/leave`);
        return res.data;
    } catch  {
        return {
            success: false
        };
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/socket.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "connectSocket",
    ()=>connectSocket,
    "disconnectSocket",
    ()=>disconnectSocket,
    "getSocket",
    ()=>getSocket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [client] (ecmascript) <locals>");
;
const WS_URL = ("TURBOPACK compile-time value", "http://localhost:5000") || 'http://localhost:5000';
let socket = null;
function getSocket() {
    if (!socket) {
        socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])(WS_URL, {
            autoConnect: false,
            transports: [
                'websocket',
                'polling'
            ]
        });
        socket.on('connect', ()=>console.log('Socket connected:', socket?.id));
        socket.on('disconnect', (reason)=>console.log('Socket disconnected:', reason));
        socket.on('connect_error', (err)=>console.error('Socket error:', err.message));
    }
    return socket;
}
function connectSocket() {
    const s = getSocket();
    if (!s.connected) s.connect();
}
function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/webrtc/MediaDevices.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getLocalStream",
    ()=>getLocalStream,
    "getScreenStream",
    ()=>getScreenStream,
    "stopMediaStream",
    ()=>stopMediaStream,
    "toggleAudio",
    ()=>toggleAudio,
    "toggleVideo",
    ()=>toggleVideo
]);
async function getLocalStream(audio = true, video = true) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } : false,
        video: video ? {
            width: {
                ideal: 1280
            },
            height: {
                ideal: 720
            },
            frameRate: {
                ideal: 30
            }
        } : false
    });
    return stream;
}
function stopMediaStream(stream) {
    stream.getTracks().forEach((t)=>t.stop());
}
function toggleAudio(stream, enabled) {
    const track = stream.getAudioTracks()[0];
    if (track) track.enabled = enabled;
}
function toggleVideo(stream, enabled) {
    const track = stream.getVideoTracks()[0];
    if (track) track.enabled = enabled;
}
async function getScreenStream() {
    return navigator.mediaDevices.getDisplayMedia({
        video: {
            cursor: 'always'
        },
        audio: false
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/webrtc/PeerConnection.ts [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addStreamToPeer",
    ()=>addStreamToPeer,
    "createOffer",
    ()=>createOffer,
    "createPeerConnection",
    ()=>createPeerConnection,
    "handleAnswer",
    ()=>handleAnswer,
    "handleIceCandidate",
    ()=>handleIceCandidate,
    "handleOffer",
    ()=>handleOffer
]);
const ICE_SERVERS = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            urls: 'stun:stun1.l.google.com:19302'
        }
    ]
};
function createPeerConnection(socketId, callbacks) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.ontrack = (event)=>{
        const [remoteStream] = event.streams;
        callbacks.onTrack(remoteStream, socketId);
    };
    pc.onicecandidate = (event)=>{
        if (event.candidate) callbacks.onIceCandidate(event.candidate, socketId);
    };
    pc.onconnectionstatechange = ()=>{
        console.log(`Peer ${socketId}: ${pc.connectionState}`);
    };
    return pc;
}
async function createOffer(pc) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
}
async function handleOffer(pc, offer) {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
}
async function handleAnswer(pc, answer) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
}
async function handleIceCandidate(pc, candidate) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
}
function addStreamToPeer(pc, stream) {
    stream.getTracks().forEach((track)=>pc.addTrack(track, stream));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/pages/meeting/[code].tsx [client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MeetingRoom
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/jsx-dev-runtime.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react/index.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/router.js [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/AuthContext.tsx [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/socket.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/webrtc/MediaDevices.ts [client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/webrtc/PeerConnection.ts [client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
// Deterministic avatar colors
const AVATAR_COLORS = [
    'linear-gradient(135deg, #4285f4, #34a853)',
    'linear-gradient(135deg, #ea4335, #fbbc04)',
    'linear-gradient(135deg, #7c3aed, #ec4899)',
    'linear-gradient(135deg, #00d4aa, #3b82f6)',
    'linear-gradient(135deg, #f97316, #ef4444)',
    'linear-gradient(135deg, #06b6d4, #8b5cf6)'
];
function getAvatarColor(name) {
    let hash = 0;
    for(let i = 0; i < name.length; i++)hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function MeetingRoom() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { code } = router.query;
    const { user, loading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [localStream, setLocalStream] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [remotePeers, setRemotePeers] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(new Map());
    const [audioEnabled, setAudioEnabled] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [videoEnabled, setVideoEnabled] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [chatOpen, setChatOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [messages, setMessages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [chatInput, setChatInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [participantCount, setParticipantCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(1);
    const [meetingTitle, setMeetingTitle] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [isConnected, setIsConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [screenSharing, setScreenSharing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [unreadCount, setUnreadCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(0);
    // Pin state: 'self' for own video, socketId for remote, null for grid mode
    const [pinnedId, setPinnedId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const localVideoRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const pipVideoRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const spotlightVideoRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const chatEndRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const peersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    const localStreamRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const meetingCode = typeof code === 'string' ? code : '';
    // Scroll chat to bottom
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MeetingRoom.useEffect": ()=>{
            chatEndRef.current?.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }["MeetingRoom.useEffect"], [
        messages
    ]);
    // Unread tracking
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MeetingRoom.useEffect": ()=>{
            if (chatOpen) setUnreadCount(0);
        }
    }["MeetingRoom.useEffect"], [
        chatOpen
    ]);
    // Sync PiP video
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MeetingRoom.useEffect": ()=>{
            if (pipVideoRef.current && localStream) pipVideoRef.current.srcObject = localStream;
        }
    }["MeetingRoom.useEffect"], [
        localStream,
        remotePeers.size
    ]);
    // Sync spotlight video when pinned changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MeetingRoom.useEffect": ()=>{
            if (!spotlightVideoRef.current) return;
            if (pinnedId === 'self' && localStream) {
                spotlightVideoRef.current.srcObject = localStream;
            } else if (pinnedId) {
                const peer = peersRef.current.get(pinnedId);
                if (peer?.stream) spotlightVideoRef.current.srcObject = peer.stream;
            }
        }
    }["MeetingRoom.useEffect"], [
        pinnedId,
        localStream,
        remotePeers
    ]);
    // If pinned peer leaves, unpin
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MeetingRoom.useEffect": ()=>{
            if (pinnedId && pinnedId !== 'self' && !remotePeers.has(pinnedId)) {
                setPinnedId(null);
            }
        }
    }["MeetingRoom.useEffect"], [
        pinnedId,
        remotePeers
    ]);
    const makePeerCallbacks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MeetingRoom.useCallback[makePeerCallbacks]": ()=>({
                onTrack: ({
                    "MeetingRoom.useCallback[makePeerCallbacks]": (stream, socketId)=>{
                        setRemotePeers({
                            "MeetingRoom.useCallback[makePeerCallbacks]": (prev)=>{
                                const next = new Map(prev);
                                const peer = next.get(socketId);
                                if (peer) next.set(socketId, {
                                    ...peer,
                                    stream
                                });
                                return next;
                            }
                        }["MeetingRoom.useCallback[makePeerCallbacks]"]);
                        const peer = peersRef.current.get(socketId);
                        if (peer) peer.stream = stream;
                    }
                })["MeetingRoom.useCallback[makePeerCallbacks]"],
                onIceCandidate: ({
                    "MeetingRoom.useCallback[makePeerCallbacks]": (candidate, to)=>{
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSocket"])().emit('ice-candidate', {
                            candidate,
                            to
                        });
                    }
                })["MeetingRoom.useCallback[makePeerCallbacks]"]
            })
    }["MeetingRoom.useCallback[makePeerCallbacks]"], []);
    // Main connection logic
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$index$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MeetingRoom.useEffect": ()=>{
            if (!meetingCode || !user || loading) return;
            let isMounted = true;
            async function init() {
                try {
                    const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getMeeting"])(meetingCode);
                    if (data.meeting) setMeetingTitle(data.meeting.title || '');
                } catch  {}
                try {
                    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["joinMeetingAPI"])(meetingCode);
                } catch  {}
                let stream;
                try {
                    stream = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getLocalStream"])();
                } catch  {
                    try {
                        stream = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getLocalStream"])(true, false);
                    } catch  {
                        alert('Could not access camera or microphone.');
                        return;
                    }
                }
                if (!isMounted) {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["stopMediaStream"])(stream);
                    return;
                }
                setLocalStream(stream);
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["connectSocket"])();
                const socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSocket"])();
                const emitJoin = {
                    "MeetingRoom.useEffect.init.emitJoin": ()=>{
                        socket.emit('join-room', {
                            roomId: meetingCode,
                            userId: user.id,
                            userName: user.username
                        });
                    }
                }["MeetingRoom.useEffect.init.emitJoin"];
                socket.on('connect', {
                    "MeetingRoom.useEffect.init": ()=>{
                        if (!isMounted) return;
                        setIsConnected(true);
                        emitJoin();
                    }
                }["MeetingRoom.useEffect.init"]);
                if (socket.connected) {
                    setIsConnected(true);
                    emitJoin();
                }
                socket.on('existing-participants', {
                    "MeetingRoom.useEffect.init": ({ participants })=>{
                        participants.forEach({
                            "MeetingRoom.useEffect.init": async (socketId)=>{
                                const callbacks = makePeerCallbacks();
                                const pc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["createPeerConnection"])(socketId, callbacks);
                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["addStreamToPeer"])(pc, localStreamRef.current);
                                const peer = {
                                    socketId,
                                    userName: '',
                                    stream: null,
                                    pc
                                };
                                peersRef.current.set(socketId, peer);
                                setRemotePeers(new Map(peersRef.current));
                                const offer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["createOffer"])(pc);
                                socket.emit('offer', {
                                    offer,
                                    to: socketId,
                                    userName: user.username
                                });
                            }
                        }["MeetingRoom.useEffect.init"]);
                    }
                }["MeetingRoom.useEffect.init"]);
                socket.on('user-joined', {
                    "MeetingRoom.useEffect.init": ({ socketId, userName })=>{
                        const callbacks = makePeerCallbacks();
                        const pc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["createPeerConnection"])(socketId, callbacks);
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["addStreamToPeer"])(pc, localStreamRef.current);
                        const peer = {
                            socketId,
                            userName,
                            stream: null,
                            pc
                        };
                        peersRef.current.set(socketId, peer);
                        setRemotePeers(new Map(peersRef.current));
                    }
                }["MeetingRoom.useEffect.init"]);
                socket.on('offer', {
                    "MeetingRoom.useEffect.init": async ({ offer, from, userName })=>{
                        let peer = peersRef.current.get(from);
                        if (!peer) {
                            const callbacks = makePeerCallbacks();
                            const pc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["createPeerConnection"])(from, callbacks);
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["addStreamToPeer"])(pc, localStreamRef.current);
                            peer = {
                                socketId: from,
                                userName,
                                stream: null,
                                pc
                            };
                            peersRef.current.set(from, peer);
                        }
                        if (userName) peer.userName = userName;
                        const answer = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["handleOffer"])(peer.pc, offer);
                        socket.emit('answer', {
                            answer,
                            to: from
                        });
                        setRemotePeers(new Map(peersRef.current));
                    }
                }["MeetingRoom.useEffect.init"]);
                socket.on('answer', {
                    "MeetingRoom.useEffect.init": async ({ answer, from })=>{
                        const peer = peersRef.current.get(from);
                        if (peer) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["handleAnswer"])(peer.pc, answer);
                    }
                }["MeetingRoom.useEffect.init"]);
                socket.on('ice-candidate', {
                    "MeetingRoom.useEffect.init": async ({ candidate, from })=>{
                        const peer = peersRef.current.get(from);
                        if (peer) await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$PeerConnection$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["handleIceCandidate"])(peer.pc, candidate);
                    }
                }["MeetingRoom.useEffect.init"]);
                socket.on('user-left', {
                    "MeetingRoom.useEffect.init": ({ socketId })=>{
                        const peer = peersRef.current.get(socketId);
                        if (peer) {
                            peer.pc.close();
                            peersRef.current.delete(socketId);
                            setRemotePeers(new Map(peersRef.current));
                        }
                    }
                }["MeetingRoom.useEffect.init"]);
                socket.on('participant-count', {
                    "MeetingRoom.useEffect.init": (count)=>setParticipantCount(count)
                }["MeetingRoom.useEffect.init"]);
                socket.on('new-message', {
                    "MeetingRoom.useEffect.init": (msg)=>{
                        setMessages({
                            "MeetingRoom.useEffect.init": (prev)=>[
                                    ...prev,
                                    msg
                                ]
                        }["MeetingRoom.useEffect.init"]);
                        setChatOpen({
                            "MeetingRoom.useEffect.init": (prev)=>{
                                if (!prev) setUnreadCount({
                                    "MeetingRoom.useEffect.init": (c)=>c + 1
                                }["MeetingRoom.useEffect.init"]);
                                return prev;
                            }
                        }["MeetingRoom.useEffect.init"]);
                    }
                }["MeetingRoom.useEffect.init"]);
            }
            init();
            return ({
                "MeetingRoom.useEffect": ()=>{
                    isMounted = false;
                    const socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSocket"])();
                    socket.emit('leave-room', {
                        roomId: meetingCode
                    });
                    socket.off('existing-participants');
                    socket.off('user-joined');
                    socket.off('offer');
                    socket.off('answer');
                    socket.off('ice-candidate');
                    socket.off('user-left');
                    socket.off('participant-count');
                    socket.off('new-message');
                    peersRef.current.forEach({
                        "MeetingRoom.useEffect": (p)=>p.pc.close()
                    }["MeetingRoom.useEffect"]);
                    peersRef.current.clear();
                    if (localStreamRef.current) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["stopMediaStream"])(localStreamRef.current);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["leaveMeetingAPI"])(meetingCode).catch({
                        "MeetingRoom.useEffect": ()=>{}
                    }["MeetingRoom.useEffect"]);
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["disconnectSocket"])();
                }
            })["MeetingRoom.useEffect"];
        }
    }["MeetingRoom.useEffect"], [
        meetingCode,
        user,
        loading,
        makePeerCallbacks
    ]);
    // Toggle audio/video
    const handleToggleAudio = ()=>{
        if (localStream) {
            const next = !audioEnabled;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["toggleAudio"])(localStream, next);
            setAudioEnabled(next);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSocket"])().emit('toggle-media', {
                roomId: meetingCode,
                type: 'audio',
                enabled: next
            });
        }
    };
    const handleToggleVideo = ()=>{
        if (localStream) {
            const next = !videoEnabled;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["toggleVideo"])(localStream, next);
            setVideoEnabled(next);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSocket"])().emit('toggle-media', {
                roomId: meetingCode,
                type: 'video',
                enabled: next
            });
        }
    };
    // Screen sharing
    const handleScreenShare = async ()=>{
        if (screenSharing) {
            if (localStream) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["stopMediaStream"])(localStream);
            const stream = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getLocalStream"])();
            setLocalStream(stream);
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const videoTrack = stream.getVideoTracks()[0];
            peersRef.current.forEach((peer)=>{
                const sender = peer.pc.getSenders().find((s)=>s.track?.kind === 'video');
                if (sender && videoTrack) sender.replaceTrack(videoTrack);
            });
            setScreenSharing(false);
        } else {
            try {
                const screen = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$webrtc$2f$MediaDevices$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getScreenStream"])();
                const videoTrack = screen.getVideoTracks()[0];
                if (localVideoRef.current) localVideoRef.current.srcObject = screen;
                peersRef.current.forEach((peer)=>{
                    const sender = peer.pc.getSenders().find((s)=>s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                });
                videoTrack.onended = ()=>handleScreenShare();
                setLocalStream(screen);
                localStreamRef.current = screen;
                setScreenSharing(true);
            } catch  {}
        }
    };
    // Chat
    const sendMessage = ()=>{
        const msg = chatInput.trim();
        if (!msg || !user) return;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$socket$2e$ts__$5b$client$5d$__$28$ecmascript$29$__["getSocket"])().emit('send-message', {
            roomId: meetingCode,
            userId: user.id,
            userName: user.username,
            message: msg
        });
        setChatInput('');
    };
    // Copy code
    const copyCode = ()=>{
        navigator.clipboard.writeText(meetingCode);
        setCopied(true);
        setTimeout(()=>setCopied(false), 2000);
    };
    // Pin/Unpin
    const togglePin = (id)=>{
        setPinnedId((prev)=>prev === id ? null : id);
    };
    const handleLeave = ()=>router.push('/dashboard');
    if (loading || !user) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "center-loader",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "spinner"
        }, void 0, false, {
            fileName: "[project]/src/pages/meeting/[code].tsx",
            lineNumber: 304,
            columnNumber: 65
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/pages/meeting/[code].tsx",
        lineNumber: 304,
        columnNumber: 34
    }, this);
    const remotePeerArray = Array.from(remotePeers.values());
    const hasRemotePeers = remotePeerArray.length > 0;
    const gridCount = hasRemotePeers ? remotePeerArray.length : 1;
    const gridDataCount = gridCount <= 9 ? String(gridCount) : 'many';
    // Helper: render a video tile
    const renderTile = (id, name, stream, isSelf, opts = {})=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `video-tile ${isSelf && opts.inFilmstrip ? 'is-self' : ''}`,
            onClick: opts.inFilmstrip ? ()=>togglePin(id) : undefined,
            children: [
                stream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                    autoPlay: true,
                    playsInline: true,
                    muted: isSelf,
                    style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: isSelf ? 'scaleX(-1)' : undefined,
                        display: isSelf && !videoEnabled ? 'none' : 'block'
                    },
                    ref: (el)=>{
                        if (el) el.srcObject = stream;
                    }
                }, void 0, false, {
                    fileName: "[project]/src/pages/meeting/[code].tsx",
                    lineNumber: 322,
                    columnNumber: 17
                }, this) : null,
                isSelf && !videoEnabled || !stream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "avatar-placeholder",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "avatar-circle",
                        style: {
                            background: getAvatarColor(name)
                        },
                        children: name[0]?.toUpperCase() || '?'
                    }, void 0, false, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 334,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/pages/meeting/[code].tsx",
                    lineNumber: 333,
                    columnNumber: 17
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "name-tag",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "icon",
                            children: "person"
                        }, void 0, false, {
                            fileName: "[project]/src/pages/meeting/[code].tsx",
                            lineNumber: 340,
                            columnNumber: 17
                        }, this),
                        name,
                        isSelf ? ' (You)' : ''
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/pages/meeting/[code].tsx",
                    lineNumber: 339,
                    columnNumber: 13
                }, this),
                isSelf && !audioEnabled && !opts.inFilmstrip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "muted-indicator",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "icon",
                        children: "mic_off"
                    }, void 0, false, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 345,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/pages/meeting/[code].tsx",
                    lineNumber: 344,
                    columnNumber: 17
                }, this),
                opts.showPin && !opts.inFilmstrip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    className: `pin-btn ${pinnedId === id ? 'is-pinned' : ''}`,
                    onClick: (e)=>{
                        e.stopPropagation();
                        togglePin(id);
                    },
                    title: pinnedId === id ? 'Unpin' : 'Pin',
                    "aria-label": pinnedId === id ? 'Unpin this video' : 'Pin this video',
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "icon",
                        children: pinnedId === id ? 'push_pin' : 'push_pin'
                    }, void 0, false, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 356,
                        columnNumber: 21
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/pages/meeting/[code].tsx",
                    lineNumber: 350,
                    columnNumber: 17
                }, this)
            ]
        }, id, true, {
            fileName: "[project]/src/pages/meeting/[code].tsx",
            lineNumber: 316,
            columnNumber: 9
        }, this);
    // Determine pinned participant info
    const pinnedPeer = pinnedId === 'self' ? null : remotePeerArray.find((p)=>p.socketId === pinnedId);
    const isPinActive = pinnedId !== null && (pinnedId === 'self' || pinnedPeer);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "meeting-page",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "meeting-main",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "meeting-topbar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "meeting-info",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "meeting-title",
                                        children: meetingTitle || 'Meeting'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 372,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "meeting-meta",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                className: "meeting-code-chip",
                                                onClick: copyCode,
                                                title: "Click to copy",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "icon icon-sm",
                                                        children: copied ? 'check' : 'content_copy'
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 375,
                                                        columnNumber: 33
                                                    }, this),
                                                    copied ? 'Copied!' : meetingCode
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 374,
                                                columnNumber: 29
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                children: "•"
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 378,
                                                columnNumber: 29
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                style: {
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "icon icon-sm",
                                                        children: "group"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 380,
                                                        columnNumber: 33
                                                    }, this),
                                                    participantCount
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 379,
                                                columnNumber: 29
                                            }, this),
                                            !isConnected && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                style: {
                                                    color: '#f59e0b',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                },
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "icon icon-sm",
                                                        children: "sync"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 385,
                                                        columnNumber: 37
                                                    }, this),
                                                    " Connecting..."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 384,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 373,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 371,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "topbar-actions",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "btn-danger",
                                    onClick: handleLeave,
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "icon icon-sm",
                                            children: "call_end"
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 393,
                                            columnNumber: 29
                                        }, this),
                                        " Leave"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 391,
                                    columnNumber: 25
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 390,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 370,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "video-area",
                        children: isPinActive ? /* ===== SPOTLIGHT + FILMSTRIP MODE ===== */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "spotlight-layout",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "spotlight-main",
                                    children: [
                                        pinnedId === 'self' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                videoEnabled ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                    ref: spotlightVideoRef,
                                                    autoPlay: true,
                                                    muted: true,
                                                    playsInline: true,
                                                    style: {
                                                        transform: 'scaleX(-1)'
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 408,
                                                    columnNumber: 45
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "avatar-placeholder",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "avatar-circle",
                                                        style: {
                                                            background: getAvatarColor(user.username)
                                                        },
                                                        children: user.username[0].toUpperCase()
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 415,
                                                        columnNumber: 49
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 414,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "name-tag",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "icon",
                                                            children: "person"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                                            lineNumber: 422,
                                                            columnNumber: 45
                                                        }, this),
                                                        user.username,
                                                        " (You)"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 421,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true) : pinnedPeer ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                pinnedPeer.stream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                    ref: spotlightVideoRef,
                                                    autoPlay: true,
                                                    playsInline: true
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 429,
                                                    columnNumber: 45
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "avatar-placeholder",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "avatar-circle",
                                                        style: {
                                                            background: getAvatarColor(pinnedPeer.userName || '?')
                                                        },
                                                        children: (pinnedPeer.userName || '?')[0].toUpperCase()
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 435,
                                                        columnNumber: 49
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 434,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "name-tag",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "icon",
                                                            children: "person"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                                            lineNumber: 442,
                                                            columnNumber: 45
                                                        }, this),
                                                        pinnedPeer.userName || 'Connecting...'
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 441,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true) : null,
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "pinned-badge",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "icon",
                                                    children: "push_pin"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 450,
                                                    columnNumber: 37
                                                }, this),
                                                " Pinned"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 449,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            className: "unpin-btn",
                                            onClick: ()=>setPinnedId(null),
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "icon",
                                                    children: "close"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 455,
                                                    columnNumber: 37
                                                }, this),
                                                " Unpin"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 454,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 404,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "filmstrip",
                                    children: [
                                        pinnedId !== 'self' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "video-tile is-self",
                                            onClick: ()=>togglePin('self'),
                                            children: [
                                                videoEnabled && localStream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                    autoPlay: true,
                                                    muted: true,
                                                    playsInline: true,
                                                    style: {
                                                        transform: 'scaleX(-1)'
                                                    },
                                                    ref: (el)=>{
                                                        if (el && localStream) el.srcObject = localStream;
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 465,
                                                    columnNumber: 45
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "avatar-placeholder",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "avatar-circle",
                                                        style: {
                                                            background: getAvatarColor(user.username)
                                                        },
                                                        children: user.username[0].toUpperCase()
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 472,
                                                        columnNumber: 49
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 471,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "name-tag",
                                                    children: "You"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 478,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 463,
                                            columnNumber: 37
                                        }, this),
                                        remotePeerArray.filter((p)=>p.socketId !== pinnedId).map((peer)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "video-tile",
                                                onClick: ()=>togglePin(peer.socketId),
                                                children: [
                                                    peer.stream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                        autoPlay: true,
                                                        playsInline: true,
                                                        ref: (el)=>{
                                                            if (el && peer.stream) el.srcObject = peer.stream;
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 489,
                                                        columnNumber: 49
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "avatar-placeholder",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "avatar-circle",
                                                            style: {
                                                                background: getAvatarColor(peer.userName || '?')
                                                            },
                                                            children: (peer.userName || '?')[0].toUpperCase()
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                                            lineNumber: 495,
                                                            columnNumber: 53
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 494,
                                                        columnNumber: 49
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "name-tag",
                                                        children: peer.userName || '...'
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 501,
                                                        columnNumber: 45
                                                    }, this)
                                                ]
                                            }, peer.socketId, true, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 486,
                                                columnNumber: 41
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 460,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/pages/meeting/[code].tsx",
                            lineNumber: 402,
                            columnNumber: 25
                        }, this) : /* ===== GRID MODE (no pin) ===== */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "video-grid",
                                    "data-count": gridDataCount,
                                    children: [
                                        !hasRemotePeers && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "video-tile",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                    ref: localVideoRef,
                                                    autoPlay: true,
                                                    muted: true,
                                                    playsInline: true,
                                                    style: {
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        transform: 'scaleX(-1)',
                                                        display: videoEnabled ? 'block' : 'none'
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 513,
                                                    columnNumber: 41
                                                }, this),
                                                !videoEnabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "avatar-placeholder",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "avatar-circle",
                                                        style: {
                                                            background: getAvatarColor(user.username)
                                                        },
                                                        children: user.username[0].toUpperCase()
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 524,
                                                        columnNumber: 49
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 523,
                                                    columnNumber: 45
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "name-tag",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "icon",
                                                            children: "person"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                                            lineNumber: 531,
                                                            columnNumber: 45
                                                        }, this),
                                                        user.username,
                                                        " (You)"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 530,
                                                    columnNumber: 41
                                                }, this),
                                                !audioEnabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "muted-indicator",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "icon",
                                                        children: "mic_off"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 536,
                                                        columnNumber: 49
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                                    lineNumber: 535,
                                                    columnNumber: 45
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 512,
                                            columnNumber: 37
                                        }, this),
                                        remotePeerArray.map((peer)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "video-tile",
                                                children: [
                                                    peer.stream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                        autoPlay: true,
                                                        playsInline: true,
                                                        style: {
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        },
                                                        ref: (el)=>{
                                                            if (el && peer.stream) el.srcObject = peer.stream;
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 546,
                                                        columnNumber: 45
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "avatar-placeholder",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "avatar-circle",
                                                            style: {
                                                                background: getAvatarColor(peer.userName || '?')
                                                            },
                                                            children: (peer.userName || '?')[0].toUpperCase()
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                                            lineNumber: 553,
                                                            columnNumber: 49
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 552,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "name-tag",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "icon",
                                                                children: "person"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                                lineNumber: 560,
                                                                columnNumber: 45
                                                            }, this),
                                                            peer.userName || 'Connecting...'
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 559,
                                                        columnNumber: 41
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        className: "pin-btn",
                                                        onClick: ()=>togglePin(peer.socketId),
                                                        title: "Pin this video",
                                                        "aria-label": "Pin this video",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "icon",
                                                            children: "push_pin"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                                            lineNumber: 570,
                                                            columnNumber: 45
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                                        lineNumber: 564,
                                                        columnNumber: 41
                                                    }, this)
                                                ]
                                            }, peer.socketId, true, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 544,
                                                columnNumber: 37
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 509,
                                    columnNumber: 29
                                }, this),
                                hasRemotePeers && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "self-view-pip",
                                    onClick: ()=>togglePin('self'),
                                    children: [
                                        videoEnabled ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                            ref: pipVideoRef,
                                            autoPlay: true,
                                            muted: true,
                                            playsInline: true
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 580,
                                            columnNumber: 41
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "avatar-placeholder",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "avatar-circle",
                                                style: {
                                                    background: getAvatarColor(user.username)
                                                },
                                                children: user.username[0].toUpperCase()
                                            }, void 0, false, {
                                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                                lineNumber: 583,
                                                columnNumber: 45
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 582,
                                            columnNumber: 41
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "name-tag",
                                            children: "You"
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 589,
                                            columnNumber: 37
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 578,
                                    columnNumber: 33
                                }, this)
                            ]
                        }, void 0, true)
                    }, void 0, false, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 399,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "controls-bar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: `ctrl-btn ${!audioEnabled ? 'off' : ''}`,
                                onClick: handleToggleAudio,
                                "aria-label": audioEnabled ? 'Mute' : 'Unmute',
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: audioEnabled ? 'mic' : 'mic_off'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 600,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "label",
                                        children: audioEnabled ? 'Mic' : 'Muted'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 601,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 598,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: `ctrl-btn ${!videoEnabled ? 'off' : ''}`,
                                onClick: handleToggleVideo,
                                "aria-label": videoEnabled ? 'Camera off' : 'Camera on',
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: videoEnabled ? 'videocam' : 'videocam_off'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 605,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "label",
                                        children: videoEnabled ? 'Video' : 'Off'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 606,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 603,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: `ctrl-btn ${screenSharing ? 'active-feature' : ''}`,
                                onClick: handleScreenShare,
                                "aria-label": "Screen share",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: screenSharing ? 'stop_screen_share' : 'present_to_all'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 610,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "label",
                                        children: "Present"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 611,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 608,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: `ctrl-btn ${chatOpen ? 'active-feature' : ''}`,
                                onClick: ()=>setChatOpen(!chatOpen),
                                "aria-label": "Chat",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: "chat"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 615,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "label",
                                        children: "Chat"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 616,
                                        columnNumber: 25
                                    }, this),
                                    unreadCount > 0 && !chatOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "badge",
                                        children: unreadCount > 9 ? '9+' : unreadCount
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 618,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 613,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "ctrl-btn",
                                onClick: copyCode,
                                "aria-label": "Copy code",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: copied ? 'check' : 'content_copy'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 622,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "label",
                                        children: copied ? 'Copied' : 'Copy'
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 623,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 621,
                                columnNumber: 21
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "ctrl-btn end-call",
                                onClick: handleLeave,
                                "aria-label": "Leave",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: "call_end"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 626,
                                        columnNumber: 25
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "label",
                                        children: "Leave"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 627,
                                        columnNumber: 25
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 625,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 597,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/pages/meeting/[code].tsx",
                lineNumber: 368,
                columnNumber: 13
            }, this),
            chatOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "chat-panel fade-in",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "chat-header",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        children: "chat"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 637,
                                        columnNumber: 29
                                    }, this),
                                    " In-call messages"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 636,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "chat-close-btn",
                                onClick: ()=>setChatOpen(false),
                                "aria-label": "Close chat",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "icon",
                                    children: "close"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 640,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 639,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 635,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "chat-messages",
                        children: [
                            messages.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                style: {
                                    textAlign: 'center',
                                    padding: 'clamp(24px, 5vw, 40px)',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.85rem'
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "icon",
                                        style: {
                                            fontSize: 48,
                                            display: 'block',
                                            marginBottom: 12,
                                            opacity: 0.3
                                        },
                                        children: "forum"
                                    }, void 0, false, {
                                        fileName: "[project]/src/pages/meeting/[code].tsx",
                                        lineNumber: 649,
                                        columnNumber: 33
                                    }, this),
                                    "Messages can only be seen by people in the call."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 645,
                                columnNumber: 29
                            }, this),
                            messages.map((msg, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "chat-bubble",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "sender",
                                            children: msg.userId === user.id ? 'You' : msg.userName
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 655,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text",
                                            children: msg.message
                                        }, void 0, false, {
                                            fileName: "[project]/src/pages/meeting/[code].tsx",
                                            lineNumber: 656,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, msg.id || i, true, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 654,
                                    columnNumber: 29
                                }, this)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                ref: chatEndRef
                            }, void 0, false, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 659,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 643,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "chat-input-area",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "input-field",
                                placeholder: "Send a message...",
                                value: chatInput,
                                onChange: (e)=>setChatInput(e.target.value),
                                onKeyDown: (e)=>e.key === 'Enter' && !e.shiftKey && sendMessage(),
                                style: {
                                    flex: 1,
                                    padding: '10px 14px'
                                }
                            }, void 0, false, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 662,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "ctrl-btn active-feature",
                                onClick: sendMessage,
                                disabled: !chatInput.trim(),
                                "aria-label": "Send",
                                style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    opacity: chatInput.trim() ? 1 : 0.4
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "icon",
                                    children: "send"
                                }, void 0, false, {
                                    fileName: "[project]/src/pages/meeting/[code].tsx",
                                    lineNumber: 670,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/pages/meeting/[code].tsx",
                                lineNumber: 667,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/pages/meeting/[code].tsx",
                        lineNumber: 661,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/pages/meeting/[code].tsx",
                lineNumber: 634,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/pages/meeting/[code].tsx",
        lineNumber: 367,
        columnNumber: 9
    }, this);
}
_s(MeetingRoom, "CSCqbd7TuWLNJGR010iXlhcrKtc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$router$2e$js__$5b$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = MeetingRoom;
var _c;
__turbopack_context__.k.register(_c, "MeetingRoom");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/meeting/[code].tsx [client] (ecmascript)\" } [client] (ecmascript)", ((__turbopack_context__, module, exports) => {

const PAGE_PATH = "/meeting/[code]";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_context__.r("[project]/src/pages/meeting/[code].tsx [client] (ecmascript)");
    }
]);
// @ts-expect-error module.hot exists
if (module.hot) {
    // @ts-expect-error module.hot exists
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}
}),
"[hmr-entry]/hmr-entry.js { ENTRY => \"[project]/src/pages/meeting/[code].tsx\" }", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.r("[next]/entry/page-loader.ts { PAGE => \"[project]/src/pages/meeting/[code].tsx [client] (ecmascript)\" } [client] (ecmascript)");
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__599dd5be._.js.map