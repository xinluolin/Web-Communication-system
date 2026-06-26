// ==============================
// WebSocket Connection + User Management
// ==============================

let ws;
let currentUser;
let onlineUsers = [];

window.history.pushState(null, null, location.href);
window.addEventListener('popstate', function() {
    if (ws) ws.close();
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("chatBox").style.display = "none";
    document.getElementById("username").value = "";
    window.history.pushState(null, null, location.href);
});

function login() {
    let username = document.getElementById("username").value.trim();
    if (!username) {
        alert("Please enter a username");
        return;
    }
    currentUser = username;
    ws = new WebSocket("ws://" + location.host + "/chat");

    ws.onopen = function () {
        ws.send(JSON.stringify({
            type: "REGISTER",
            from: currentUser
        }));
    };

    ws.onmessage = function (evt) {
        let msg = JSON.parse(evt.data);

        if (msg.type === "REGISTER_FAIL") {
            alert("Username already online, please use a different name!");
            ws.close();
            document.getElementById("loginBox").style.display = "block";
            document.getElementById("chatBox").style.display = "none";
            document.getElementById("username").value = "";
            return;
        }

        if (msg.type === "REGISTER_SUCCESS") {
            document.getElementById("loginBox").style.display = "none";
            document.getElementById("chatBox").style.display = "flex";
            document.getElementById("userName").innerText = currentUser;
            return;
        }

        if (msg.type === "ONLINE_USERS") {
            onlineUsers = msg.users;
            return;
        }

        onMessageReceived(msg);
    };

    ws.onclose = function () {
        document.getElementById("loginBox").style.display = "block";
        document.getElementById("chatBox").style.display = "none";
    };
}

function sendMessage() {
    let input = document.getElementById("msgInput");
    let content = input.value.trim();
    if (!content) return;
    ws.send(JSON.stringify({
        type: "CHAT",
        from: currentUser,
        ciphertext: content
    }));
    input.value = "";
}

function searchUser() {
    let searchInput = document.getElementById("searchUserInput");
    let targetUser = searchInput.value.trim();
    let resultDom = document.getElementById("searchResult");

    resultDom.className = "search-result";
    resultDom.innerText = "";
    resultDom.onclick = null;

    if (!targetUser) {
        resultDom.innerText = "Please enter a username to search";
        resultDom.className = "search-result result-empty";
        return;
    }

    if (onlineUsers.includes(targetUser)) {
        resultDom.innerHTML = '<span class="found-name">' + targetUser + '</span><span class="found-hint">Click to start session</span>';
        resultDom.className = "search-result result-found";
        resultDom.onclick = function() {
            if (typeof requestSession !== "function") {
                alert("Session feature not loaded, please refresh the page");
                return;
            }
            try {
                requestSession(targetUser);
            } catch (e) {
                console.error("requestSession exception:", e);
                alert("Session request failed: " + e.message);
            }
        };
    } else {
        resultDom.innerText = "User '" + targetUser + "' not found or offline";
        resultDom.className = "search-result result-not-found";
    }
}

function clearSearchResult() {
    let resultDom = document.getElementById("searchResult");
    let inputVal = document.getElementById("searchUserInput").value.trim();
    if (inputVal === "") {
        resultDom.innerHTML = "";
        resultDom.className = "search-result";
        resultDom.onclick = null;
    }
}
