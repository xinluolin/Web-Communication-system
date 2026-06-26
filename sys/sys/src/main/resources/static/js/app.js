// ==============================
// Session Management + Chat UI
// ==============================

let activeSessions = {};
let currentSessionId = null;

const KEY_STATUS = {
    NONE: "none",
    PENDING: "pending",
    REQUESTING: "requesting",
    RESPONDING: "responding",
    COMPLETE: "complete"
};

let selectedEncAlgo = "CBC";
let selectedHashAlgo = "MD5";

// ============================== Session Request (Initiator A) ==============================
function requestSession(targetUser) {
    if (!currentUser) {
        alert("Please login first");
        return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("WebSocket not connected, please re-login");
        return;
    }
    if (targetUser === currentUser) {
        alert("Cannot create session with yourself");
        return;
    }
    for (let sid in activeSessions) {
        let s = activeSessions[sid];
        if (s.peer === targetUser && s.status !== "closed") {
            switchToSession(sid);
            return;
        }
    }
    try {
        const sessionId = CryptoChat.generateUUID();
        activeSessions[sessionId] = {
            sessionId: sessionId,
            peer: targetUser,
            privateKey: null,
            publicKey: null,
            peerPublicKey: null,
            keyObj: null,
            status: KEY_STATUS.PENDING,
            encAlgo: selectedEncAlgo,
            hashAlgo: selectedHashAlgo,
            isInitiator: true
        };
        currentSessionId = sessionId;
        ws.send(JSON.stringify({
            type: "SESSION_REQUEST",
            from: currentUser,
            to: targetUser,
            sessionId: sessionId,
            encAlgo: selectedEncAlgo,
            hashAlgo: selectedHashAlgo
        }));
        addSessionTab(sessionId, targetUser);
        showKeyExchangeStatus(sessionId, "Waiting for " + targetUser + "...");
    } catch (e) {
        console.error("requestSession error:", e);
        alert("Session request failed: " + e.message);
    }
}

// ============================== Handle Incoming Session Request (Receiver B) ==============================
function handleSessionRequest(msg) {
    const from = msg.from;
    const sessionId = msg.sessionId;
    const encAlgo = msg.encAlgo || "CBC";
    const hashAlgo = msg.hashAlgo || "MD5";
    activeSessions[sessionId] = {
        sessionId: sessionId,
        peer: from,
        privateKey: null,
        publicKey: null,
        peerPublicKey: null,
        keyObj: null,
        status: KEY_STATUS.PENDING,
        encAlgo: encAlgo,
        hashAlgo: hashAlgo,
        isInitiator: false
    };
    addSessionTab(sessionId, from);
    showKeyExchangeStatus(sessionId, "Session request received");
    showSessionRequestDialog(from, sessionId);
}

function acceptSession(sessionId) {
    const session = activeSessions[sessionId];
    if (!session) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert("WebSocket not connected");
        return;
    }
    try {
        const keyPair = CryptoChat.generateKeyPair();
        const publicKeyBase64 = CryptoChat.publicKeyToBase64(keyPair.publicKey);
        session.privateKey = keyPair.privateKey;
        session.publicKey = keyPair.publicKey;
        session.status = KEY_STATUS.REQUESTING;
        ws.send(JSON.stringify({
            type: "SESSION_ACCEPT",
            from: currentUser,
            to: session.peer,
            sessionId: sessionId,
            random: publicKeyBase64,
            encAlgo: session.encAlgo,
            hashAlgo: session.hashAlgo
        }));
        showKeyExchangeStatus(sessionId, "Waiting for peer public key...");
    } catch (e) {
        console.error("acceptSession error:", e);
        alert("Accept session failed: " + e.message);
    }
}

function rejectSession(sessionId) {
    const session = activeSessions[sessionId];
    if (session) {
        session.status = "closed";
        showKeyExchangeStatus(sessionId, "Rejected");
    }
    const tab = document.getElementById("tab_" + sessionId);
    if (tab) tab.remove();
    delete activeSessions[sessionId];
    if (currentSessionId === sessionId) {
        currentSessionId = null;
    }
}

// ============================== Handle Session Accept (Initiator A) ==============================
function handleSessionAccept(msg) {
    try {
        const sessionId = msg.sessionId;
        const session = activeSessions[sessionId];
        if (!session) return;
        const peerPublicKeyBase64 = msg.random;
        const peerPublicKey = CryptoChat.publicKeyFromBase64(peerPublicKeyBase64);
        const keyPair = CryptoChat.generateKeyPair();
        const publicKeyBase64 = CryptoChat.publicKeyToBase64(keyPair.publicKey);
        session.privateKey = keyPair.privateKey;
        session.publicKey = keyPair.publicKey;
        session.peerPublicKey = peerPublicKey;
        const keyObj = CryptoChat.deriveSessionKey(session.privateKey, peerPublicKey, sessionId);
        session.keyObj = keyObj;
        session.status = KEY_STATUS.RESPONDING;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "KEY_EXCHANGE",
                from: currentUser,
                to: session.peer,
                sessionId: sessionId,
                step: "RESPONSE",
                random: publicKeyBase64
            }));
        }
        showKeyExchangeStatus(sessionId, "Key exchange in progress...");
        if (typeof onSessionEstablished === "function") {
            onSessionEstablished(sessionId, session.peer, keyObj, session.encAlgo, session.hashAlgo);
        }
    } catch (e) {
        console.error("handleSessionAccept error:", e);
        alert("Session accept failed: " + e.message);
    }
}

// ============================== Handle Key Exchange Response (Receiver B) ==============================
function handleKeyExchangeResponse(msg) {
    try {
        const sessionId = msg.sessionId;
        const session = activeSessions[sessionId];
        if (!session) return;
        const peerPublicKeyBase64 = msg.random;
        const peerPublicKey = CryptoChat.publicKeyFromBase64(peerPublicKeyBase64);
        const keyObj = CryptoChat.deriveSessionKey(session.privateKey, peerPublicKey, sessionId);
        session.peerPublicKey = peerPublicKey;
        session.keyObj = keyObj;
        session.status = KEY_STATUS.COMPLETE;
        showKeyExchangeStatus(sessionId, "Key exchange complete");
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "KEY_EXCHANGE",
                from: currentUser,
                to: session.peer,
                sessionId: sessionId,
                step: "COMPLETE"
            }));
        }
        if (typeof onSessionEstablished === "function") {
            onSessionEstablished(sessionId, session.peer, keyObj, session.encAlgo, session.hashAlgo);
        }
    } catch (e) {
        console.error("handleKeyExchangeResponse error:", e);
        alert("Key exchange failed: " + e.message);
    }
}

// ============================== Handle Key Exchange Complete (Initiator A) ==============================
function handleKeyExchangeComplete(msg) {
    const sessionId = msg.sessionId;
    const session = activeSessions[sessionId];
    if (!session) return;
    session.status = KEY_STATUS.COMPLETE;
    showKeyExchangeStatus(sessionId, "Key exchange complete");
}

// ============================== Dialog UI ==============================
let _dialogOverlay = null;
let _dialogAvatar = null;
let _dialogTitle = null;
let _dialogDetail = null;
let _dialogAcceptBtn = null;
let _dialogRejectBtn = null;

function ensureDialogDOM() {
    if (_dialogOverlay) return;
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.style.display = "none";
    overlay.id = "sessionRequestDialog";
    overlay.innerHTML =
        '<div class="dialog-box">' +
            '<div class="dialog-avatar" id="dialogAvatar"></div>' +
            '<h3 id="sessionRequestTitle"></h3>' +
            '<p id="sessionRequestDetail" class="dialog-detail"></p>' +
            '<div class="dialog-buttons">' +
                '<button id="sessionRequestReject" class="btn-reject">Reject</button>' +
                '<button id="sessionRequestAccept" class="btn-accept">Accept</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    _dialogOverlay = overlay;
    _dialogAvatar = document.getElementById("dialogAvatar");
    _dialogTitle = document.getElementById("sessionRequestTitle");
    _dialogDetail = document.getElementById("sessionRequestDetail");
    _dialogAcceptBtn = document.getElementById("sessionRequestAccept");
    _dialogRejectBtn = document.getElementById("sessionRequestReject");
}

function showSessionRequestDialog(fromUser, sessionId) {
    ensureDialogDOM();
    const initial = fromUser.charAt(0).toUpperCase();
    _dialogAvatar.innerHTML = '<div class="avatar-circle">' + initial + '</div>';
    _dialogTitle.innerText = fromUser + " wants to start a session";
    _dialogDetail.innerText = "Accept to begin key exchange and establish E2E encrypted communication";
    _dialogAcceptBtn.onclick = function () {
        _dialogOverlay.style.display = "none";
        acceptSession(sessionId);
    };
    _dialogRejectBtn.onclick = function () {
        _dialogOverlay.style.display = "none";
        rejectSession(sessionId);
    };
    _dialogOverlay.onclick = function (e) {
        if (e.target === _dialogOverlay) {
            _dialogOverlay.style.display = "none";
            rejectSession(sessionId);
        }
    };
    _dialogOverlay.style.display = "flex";
}

// ============================== Session List UI ==============================
function addSessionTab(sessionId, peerName) {
    const container = document.getElementById("sessionList");
    if (!container) return;
    if (document.getElementById("tab_" + sessionId)) return;
    const tab = document.createElement("div");
    tab.className = "session-tab";
    tab.id = "tab_" + sessionId;
    tab.onclick = function () { switchToSession(sessionId); };
    tab.innerHTML =
        '<span class="session-peer">' + peerName + '</span>' +
        '<span class="key-status key-status-negotiating" id="keyStatus_' + sessionId + '">Waiting...</span>';
    container.appendChild(tab);
    switchToSession(sessionId);
}

function switchToSession(sessionId) {
    currentSessionId = sessionId;
    document.querySelectorAll(".session-tab").forEach(function (t) {
        t.classList.remove("active");
    });
    const tab = document.getElementById("tab_" + sessionId);
    if (tab) tab.classList.add("active");
    if (typeof onSessionSwitch === "function") {
        const session = activeSessions[sessionId];
        onSessionSwitch(sessionId, session ? session.peer : null);
    }
}

function showKeyExchangeStatus(sessionId, text) {
    const statusEl = document.getElementById("keyStatus_" + sessionId);
    if (statusEl) {
        statusEl.innerText = text;
        if (text.indexOf("complete") >= 0 || text.indexOf("完成") >= 0) {
            statusEl.className = "key-status key-status-complete";
        } else if (text.indexOf("Rejected") >= 0 || text.indexOf("拒绝") >= 0) {
            statusEl.className = "key-status key-status-rejected";
        } else {
            statusEl.className = "key-status key-status-negotiating";
        }
    }
}

// ============================== Public API ==============================
function getSessionKey(sessionId) {
    const session = activeSessions[sessionId];
    return session ? session.keyObj : null;
}

function getSessionInfo(sessionId) {
    return activeSessions[sessionId] || null;
}

function getCurrentSessionId() {
    return currentSessionId;
}

function setEncAlgo(algo) {
    selectedEncAlgo = algo;
}

function setHashAlgo(algo) {
    selectedHashAlgo = algo;
}

// ============================== Message Dispatch ==============================
function onMessageReceived(msg) {
    switch (msg.type) {
        case "SESSION_REQUEST":
            handleSessionRequest(msg);
            break;
        case "SESSION_ACCEPT":
            handleSessionAccept(msg);
            break;
        case "KEY_EXCHANGE":
            if (msg.step === "RESPONSE") {
                handleKeyExchangeResponse(msg);
            } else if (msg.step === "COMPLETE") {
                handleKeyExchangeComplete(msg);
            }
            break;
        case "CHAT":
            if (typeof handleChatMessage === "function") {
                handleChatMessage(msg);
            }
            break;
    }
}

// ============================== Chat UI (Member D) ==============================

let showCiphertext = false;

const sessionMessages = {};
let activeSessionId = null;

/*
// --- Encryption algorithm selection handlers (disabled for release) ---
function onEncAlgoChange() {
    const val = document.getElementById("encAlgoSelect").value;
    setEncAlgo(val);
}

function onHashAlgoChange() {
    const val = document.getElementById("hashAlgoSelect").value;
    setHashAlgo(val);
}

function onToggleCiphertext() {
    showCiphertext = document.getElementById("showCiphertextCheckbox").checked;
    rerenderCurrentSession();
}
*/

function getActiveSessionId() {
    if (typeof getCurrentSessionId === 'function') {
        return getCurrentSessionId();
    }
    return activeSessionId;
}

function onSessionSwitch(sessionId, peer) {
    if (!sessionId) return;
    activeSessionId = sessionId;
    if (!sessionMessages[sessionId]) {
        sessionMessages[sessionId] = [];
    }
    loadSessionMessages(sessionId);
}

function loadSessionMessages(sessionId) {
    const area = document.getElementById("msgArea");
    if (!area) return;
    area.innerHTML = "";
    const messages = sessionMessages[sessionId] || [];
    messages.forEach(item => {
        renderMessageElement(area, item);
    });
    area.scrollTop = area.scrollHeight;
}

/*
// Re-render current session (used by ciphertext toggle, disabled)
function rerenderCurrentSession() {
    const sid = getActiveSessionId();
    if (sid) {
        loadSessionMessages(sid);
    }
}
*/

async function sendEncryptedMessage() {
    const input = document.getElementById("msgInput");
    const plaintext = input.value.trim();
    if (!plaintext) return;
    const sid = getActiveSessionId();
    if (!sid) {
        alert("Please create a session first");
        return;
    }
    const keyObj = getSessionKey(sid);
    if (!keyObj) {
        alert("Key exchange not yet complete, please wait...");
        return;
    }
    const session = getSessionInfo(sid);
    if (!session) {
        alert("Session info lost, please re-create session");
        return;
    }
    const encAlgo = session.encAlgo || "CBC";
    const hashAlgo = session.hashAlgo || "MD5";
    try {
        const encryptedObj = await CryptoChat.encrypt(plaintext, keyObj, encAlgo, hashAlgo);
        ws.send(JSON.stringify({
            type: "CHAT",
            from: currentUser,
            to: session.peer,
            sessionId: sid,
            messageType: "text",
            iv: encryptedObj.iv,
            encAlgo: encryptedObj.encAlgo,
            hashAlgo: encryptedObj.hashAlgo,
            ciphertext: encryptedObj.ciphertext,
            hashValue: encryptedObj.hashValue,
            hmacTag: encryptedObj.hmacTag || "",
            authTag: encryptedObj.authTag || ""
        }));
        displayMessage(sid, "mine", plaintext, encryptedObj, false, "text");
        input.value = "";
    } catch (e) {
        console.error("Encrypt failed:", e);
        alert("Encryption failed: " + e.message);
    }
}

function handleChatMessage(msg) {
    const sid = msg.sessionId;
    const messageType = msg.messageType || "text";
    const fileName = msg.fileName || "";
    if (!sid) return;
    if (!sessionMessages[sid]) {
        sessionMessages[sid] = [];
    }
    const keyObj = getSessionKey(sid);
    if (!keyObj) {
        displayMessage(sid, "peer", "[Key not negotiated, cannot decrypt]", msg, true, messageType, fileName);
        return;
    }
    CryptoChat.decrypt(msg, keyObj)
        .then(plaintext => {
            displayMessage(sid, "peer", plaintext, msg, false, messageType, fileName);
        })
        .catch(err => {
            console.error("Decrypt failed:", err);
            displayMessage(sid, "peer", "[Decrypt failed: " + err.message + "]", msg, true, messageType, fileName);
        });
}

function displayMessage(sessionId, sender, text, rawMsg, isError = false, messageType = "text", fileName = "") {
    if (!sessionMessages[sessionId]) {
        sessionMessages[sessionId] = [];
    }
    const msgObj = { sender, text, rawMsg, isError, messageType, fileName };
    sessionMessages[sessionId].push(msgObj);
    if (sessionId !== getActiveSessionId()) return;
    const area = document.getElementById("msgArea");
    if (!area) return;
    renderMessageElement(area, msgObj);
    area.scrollTop = area.scrollHeight;
}

function renderMessageElement(container, msgObj) {
    const { sender, text, rawMsg, isError, messageType, fileName } = msgObj;
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble " + sender;
    const content = document.createElement("div");
    content.className = "msg-content";

    if (messageType === "image") {
        const imgWrapper = document.createElement("div");
        imgWrapper.className = "msg-image-wrapper";
        const img = document.createElement("img");
        img.className = "msg-image";
        img.src = text;
        img.alt = fileName || "Image";
        img.loading = "lazy";
        img.onerror = function() {
            img.style.display = "none";
            const errorSpan = document.createElement("span");
            errorSpan.textContent = "[Image load failed]";
            errorSpan.style.color = "#dc2626";
            errorSpan.style.fontSize = "0.85rem";
            imgWrapper.appendChild(errorSpan);
        };
        img.onclick = function(e) {
            e.stopPropagation();
            showImagePreview(text);
        };
        if (fileName) {
            const nameLabel = document.createElement("div");
            nameLabel.style.cssText = "font-size:0.7rem;color:inherit;opacity:0.7;margin-top:2px;";
            nameLabel.textContent = fileName;
            imgWrapper.appendChild(img);
            imgWrapper.appendChild(nameLabel);
            content.appendChild(imgWrapper);
        } else {
            imgWrapper.appendChild(img);
            content.appendChild(imgWrapper);
        }
        content.style.background = "transparent";
        content.style.padding = "0";
    } else if (messageType === "video") {
        const videoWrapper = document.createElement("div");
        videoWrapper.className = "msg-video-wrapper";
        const video = document.createElement("video");
        video.className = "msg-video";
        video.src = text;
        video.preload = "metadata";
        video.controls = false;
        const playIcon = document.createElement("div");
        playIcon.className = "msg-video-play-icon";
        playIcon.innerHTML = '<i class="fas fa-play-circle"></i>';
        videoWrapper.appendChild(video);
        videoWrapper.appendChild(playIcon);
        videoWrapper.onclick = function(e) {
            e.stopPropagation();
            showVideoPreview(text, fileName);
        };
        video.onerror = function() {
            video.style.display = "none";
            playIcon.style.display = "none";
            const errorSpan = document.createElement("span");
            errorSpan.textContent = "[Video load failed]";
            errorSpan.style.color = "#dc2626";
            errorSpan.style.fontSize = "0.85rem";
            videoWrapper.appendChild(errorSpan);
        };
        if (fileName) {
            const nameLabel = document.createElement("div");
            nameLabel.style.cssText = "font-size:0.7rem;color:inherit;opacity:0.7;margin-top:2px;";
            nameLabel.textContent = fileName;
            videoWrapper.appendChild(nameLabel);
        }
        content.appendChild(videoWrapper);
        content.style.background = "transparent";
        content.style.padding = "0";
    } else {
        content.textContent = text;
    }
    bubble.appendChild(content);

    /*
    // --- Ciphertext debug info (disabled for release) ---
    if (rawMsg && rawMsg.iv) {
        const debug = document.createElement("div");
        debug.className = "debug-info";
        if (showCiphertext) debug.classList.add("visible");
        debug.innerHTML =
            "<b>IV:</b> " + rawMsg.iv + "<br>" +
            "<b>Ciphertext:</b> " + rawMsg.ciphertext + "<br>" +
            "<b>Hash:</b> " + rawMsg.hashValue;
        if (rawMsg.hmacTag) debug.innerHTML += "<br><b>HMAC:</b> " + rawMsg.hmacTag;
        if (rawMsg.authTag) debug.innerHTML += "<br><b>AuthTag:</b> " + rawMsg.authTag;
        if (isError) debug.innerHTML += "<br><span style='color:#dc2626;'>Integrity check failed or key error</span>";
        bubble.appendChild(debug);
    }
    */

    container.appendChild(bubble);
}

// ============================== Image Upload ==============================
function onImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert("Image size cannot exceed 10MB");
        return;
    }
    uploadAndSendImage(file);
}

async function uploadAndSendImage(file) {
    const sid = getActiveSessionId();
    if (!sid) {
        alert("Please create a session first");
        return;
    }
    const keyObj = getSessionKey(sid);
    if (!keyObj) {
        alert("Key exchange not yet complete, please wait...");
        return;
    }
    const session = getSessionInfo(sid);
    if (!session) {
        alert("Session info lost, please re-create session");
        return;
    }
    const input = document.getElementById("msgInput");
    const originalPlaceholder = input.placeholder;
    input.placeholder = "Uploading image...";
    input.disabled = true;
    try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload/image", {
            method: "POST",
            body: formData
        });
        const result = await response.json();
        if (!result.success) {
            alert("Image upload failed: " + (result.message || "Unknown error"));
            return;
        }
        const imageUrl = result.url;
        const fileName = result.fileName || file.name;
        await sendImageMessage(imageUrl, fileName, session, keyObj, sid);
    } catch (e) {
        console.error("Image upload failed:", e);
        alert("Image upload failed: " + e.message);
    } finally {
        input.placeholder = originalPlaceholder;
        input.disabled = false;
    }
}

async function sendImageMessage(imageUrl, fileName, session, keyObj, sid) {
    try {
        const encAlgo = session.encAlgo || "CBC";
        const hashAlgo = session.hashAlgo || "MD5";
        const encryptedObj = await CryptoChat.encrypt(imageUrl, keyObj, encAlgo, hashAlgo);
        ws.send(JSON.stringify({
            type: "CHAT",
            from: currentUser,
            to: session.peer,
            sessionId: sid,
            messageType: "image",
            fileName: fileName,
            iv: encryptedObj.iv,
            encAlgo: encryptedObj.encAlgo,
            hashAlgo: encryptedObj.hashAlgo,
            ciphertext: encryptedObj.ciphertext,
            hashValue: encryptedObj.hashValue,
            hmacTag: encryptedObj.hmacTag || "",
            authTag: encryptedObj.authTag || ""
        }));
        displayMessage(sid, "mine", imageUrl, encryptedObj, false, "image", fileName);
    } catch (e) {
        console.error("Encrypt image message failed:", e);
        alert("Send image failed: " + e.message);
    }
}

function showImagePreview(url) {
    const overlay = document.createElement("div");
    overlay.className = "image-preview-overlay";
    overlay.onclick = function() { overlay.remove(); };
    const img = document.createElement("img");
    img.src = url;
    img.onclick = function(e) { e.stopPropagation(); };
    overlay.appendChild(img);
    document.body.appendChild(overlay);
}

// ============================== Video Upload ==============================
function onVideoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = "";
    if (!file.type.startsWith("video/")) {
        alert("Please select a video file");
        return;
    }
    if (file.size > 50 * 1024 * 1024) {
        alert("Video size cannot exceed 50MB");
        return;
    }
    uploadAndSendVideo(file);
}

async function uploadAndSendVideo(file) {
    const sid = getActiveSessionId();
    if (!sid) {
        alert("Please create a session first");
        return;
    }
    const keyObj = getSessionKey(sid);
    if (!keyObj) {
        alert("Key exchange not yet complete, please wait...");
        return;
    }
    const session = getSessionInfo(sid);
    if (!session) {
        alert("Session info lost, please re-create session");
        return;
    }
    const input = document.getElementById("msgInput");
    const originalPlaceholder = input.placeholder;
    input.placeholder = "Uploading video...";
    input.disabled = true;
    try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload/video", {
            method: "POST",
            body: formData
        });
        const result = await response.json();
        if (!result.success) {
            alert("Video upload failed: " + (result.message || "Unknown error"));
            return;
        }
        const videoUrl = result.url;
        const fileName = result.fileName || file.name;
        await sendVideoMessage(videoUrl, fileName, session, keyObj, sid);
    } catch (e) {
        console.error("Video upload failed:", e);
        alert("Video upload failed: " + e.message);
    } finally {
        input.placeholder = originalPlaceholder;
        input.disabled = false;
    }
}

async function sendVideoMessage(videoUrl, fileName, session, keyObj, sid) {
    try {
        const encAlgo = session.encAlgo || "CBC";
        const hashAlgo = session.hashAlgo || "MD5";
        const encryptedObj = await CryptoChat.encrypt(videoUrl, keyObj, encAlgo, hashAlgo);
        ws.send(JSON.stringify({
            type: "CHAT",
            from: currentUser,
            to: session.peer,
            sessionId: sid,
            messageType: "video",
            fileName: fileName,
            iv: encryptedObj.iv,
            encAlgo: encryptedObj.encAlgo,
            hashAlgo: encryptedObj.hashAlgo,
            ciphertext: encryptedObj.ciphertext,
            hashValue: encryptedObj.hashValue,
            hmacTag: encryptedObj.hmacTag || "",
            authTag: encryptedObj.authTag || ""
        }));
        displayMessage(sid, "mine", videoUrl, encryptedObj, false, "video", fileName);
    } catch (e) {
        console.error("Encrypt video message failed:", e);
        alert("Send video failed: " + e.message);
    }
}

function showVideoPreview(url, fileName) {
    const overlay = document.createElement("div");
    overlay.className = "video-preview-overlay";
    const closeBtn = document.createElement("div");
    closeBtn.className = "video-preview-close";
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.onclick = function(e) {
        e.stopPropagation();
        overlay.remove();
    };
    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.autoplay = true;
    video.style.maxWidth = "90vw";
    video.style.maxHeight = "80vh";
    video.style.borderRadius = "12px";
    video.style.boxShadow = "0 20px 60px rgba(0,0,0,0.5)";
    video.onclick = function(e) { e.stopPropagation(); };
    overlay.onclick = function() { overlay.remove(); };
    overlay.appendChild(closeBtn);
    overlay.appendChild(video);
    document.body.appendChild(overlay);
}
