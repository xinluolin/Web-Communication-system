package com.im.sys.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.im.sys.model.WebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Core storage
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, com.im.sys.model.ChatSession> chatSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> userSessionMap = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> userActiveSession = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        logger.info("Client connected: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String nick = getNicknameBySession(session);
        if (nick != null) {
            sessions.remove(nick);
            logger.info("User offline: {}", nick);
            broadcastOnlineUsers();
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String json = message.getPayload();
        WebSocketMessage msg = objectMapper.readValue(json, WebSocketMessage.class);

        // User registration
        if (WebSocketMessage.TYPE_REGISTER.equals(msg.getType())) {
            String nickname = msg.getFrom();
            boolean ok = registerUser(session, nickname);
            if (ok) {
                logger.info("Registration success: {}", nickname);
                WebSocketMessage successMsg = new WebSocketMessage();
                successMsg.setType("REGISTER_SUCCESS");
                successMsg.setFrom(nickname);
                String successJson = objectMapper.writeValueAsString(successMsg);
                session.sendMessage(new TextMessage(successJson));
                broadcastOnlineUsers();
            } else {
                WebSocketMessage failMsg = new WebSocketMessage();
                failMsg.setType("REGISTER_FAIL");
                failMsg.setFrom(nickname);
                String failJson = objectMapper.writeValueAsString(failMsg);
                session.sendMessage(new TextMessage(failJson));
                session.close(CloseStatus.NOT_ACCEPTABLE);
            }
        }
        // Session creation
        else if (WebSocketMessage.TYPE_CREATE_SESSION.equals(msg.getType())) {
            handleCreateSession(session, msg);
        }
        // Session request forwarding
        else if (WebSocketMessage.TYPE_SESSION_REQUEST.equals(msg.getType())) {
            forwardToTarget(msg);
        }
        // Session accept forwarding
        else if (WebSocketMessage.TYPE_SESSION_ACCEPT.equals(msg.getType())) {
            forwardToTarget(msg);
        }
        // Key exchange forwarding
        else if (WebSocketMessage.TYPE_KEY_EXCHANGE.equals(msg.getType())) {
            handleKeyExchange(session, msg);
        }
        // Chat message forwarding
        else if (WebSocketMessage.TYPE_CHAT.equals(msg.getType())) {
            handleChatMessage(session, msg);
        }
    }

    // ================== Core Methods ==================

    public boolean registerUser(WebSocketSession session, String nickname) {
        if (nickname == null || nickname.trim().isEmpty()) return false;
        if (sessions.containsKey(nickname)) return false;
        sessions.put(nickname, session);
        return true;
    }

    public void broadcastOnlineUsers() {
        try {
            List<String> users = sessions.keySet().stream().collect(Collectors.toList());
            WebSocketMessage msg = new WebSocketMessage();
            msg.setType(WebSocketMessage.TYPE_ONLINE_USERS);
            msg.setUsers(users);
            String json = objectMapper.writeValueAsString(msg);
            for (WebSocketSession s : sessions.values()) {
                if (s.isOpen()) s.sendMessage(new TextMessage(json));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public String getNicknameBySession(WebSocketSession session) {
        return sessions.entrySet().stream()
                .filter(entry -> entry.getValue() == session)
                .map(entry -> entry.getKey())
                .findFirst().orElse(null);
    }

    public boolean isUserOnline(String nickname) {
        return sessions.containsKey(nickname);
    }

    // ================== Session Management ==================

    private void handleCreateSession(WebSocketSession session, WebSocketMessage msg) {
        try {
            String from = msg.getFrom();
            String to = msg.getTo();
            String sessionId = msg.getSessionId();

            com.im.sys.model.ChatSession chatSession = new com.im.sys.model.ChatSession(sessionId, from, to);
            chatSessions.put(sessionId, chatSession);
            userActiveSession.put(from, sessionId);

            logger.info("Session created: {} -> {}, sessionId={}", from, to, sessionId);

            WebSocketSession targetSession = sessions.get(to);
            if (targetSession != null && targetSession.isOpen()) {
                String json = objectMapper.writeValueAsString(msg);
                targetSession.sendMessage(new TextMessage(json));
                logger.info("CREATE_SESSION forwarded to {}", to);
            } else {
                logger.warn("Target user {} is offline, cannot forward CREATE_SESSION", to);
            }
        } catch (Exception e) {
            logger.error("Failed to handle CREATE_SESSION", e);
        }
    }

    private void handleKeyExchange(WebSocketSession session, WebSocketMessage msg) {
        try {
            String to = msg.getTo();
            WebSocketSession targetSession = sessions.get(to);
            if (targetSession != null && targetSession.isOpen()) {
                String json = objectMapper.writeValueAsString(msg);
                targetSession.sendMessage(new TextMessage(json));
                logger.info("KEY_EXCHANGE forwarded to {}", to);
            } else {
                logger.warn("Target user {} is offline, cannot forward KEY_EXCHANGE", to);
            }
        } catch (Exception e) {
            logger.error("Failed to handle KEY_EXCHANGE", e);
        }
    }

    private void handleChatMessage(WebSocketSession session, WebSocketMessage msg) {
        try {
            String to = msg.getTo();
            if (to == null || to.trim().isEmpty()) {
                logger.error("CHAT message missing target user (to field is empty)");
                return;
            }

            WebSocketSession targetSession = sessions.get(to);
            if (targetSession != null && targetSession.isOpen()) {
                String json = objectMapper.writeValueAsString(msg);
                targetSession.sendMessage(new TextMessage(json));
                logger.info("CHAT message forwarded to {}", to);
            } else {
                logger.warn("Target user {} is offline, message undelivered", to);
            }
        } catch (Exception e) {
            logger.error("Failed to handle CHAT message", e);
        }
    }

    private void forwardToTarget(WebSocketMessage msg) {
        try {
            String to = msg.getTo();
            WebSocketSession targetSession = sessions.get(to);
            if (targetSession != null && targetSession.isOpen()) {
                String json = objectMapper.writeValueAsString(msg);
                targetSession.sendMessage(new TextMessage(json));
                logger.info("{} forwarded to {}", msg.getType(), to);
            } else {
                logger.warn("Target user {} is offline, cannot forward {}", to, msg.getType());
            }
        } catch (Exception e) {
            logger.error("Failed to forward {}", msg.getType(), e);
        }
    }

    public boolean forwardMessage(String targetUser, String message) {
        WebSocketSession targetSession = sessions.get(targetUser);
        if (targetSession != null && targetSession.isOpen()) {
            try {
                targetSession.sendMessage(new TextMessage(message));
                return true;
            } catch (IOException e) {
                logger.error("Failed to forward message to {}", targetUser, e);
                return false;
            }
        }
        return false;
    }

    public String createChatSession(String userA, String userB) {
        String sessionId = UUID.randomUUID().toString();
        com.im.sys.model.ChatSession session = new com.im.sys.model.ChatSession(sessionId, userA, userB);
        chatSessions.put(sessionId, session);
        userActiveSession.put(userA, sessionId);
        userActiveSession.put(userB, sessionId);
        logger.info("Session created: sessionId={}, {} <-> {}", sessionId, userA, userB);
        return sessionId;
    }

    public com.im.sys.model.ChatSession getChatSession(String sessionId) {
        return chatSessions.get(sessionId);
    }

    public String getUserSession(String nickname) {
        return userActiveSession.get(nickname);
    }

    public void removeChatSession(String sessionId) {
        com.im.sys.model.ChatSession session = chatSessions.remove(sessionId);
        if (session != null) {
            userActiveSession.remove(session.getUserA());
            userActiveSession.remove(session.getUserB());
            logger.info("Session removed: sessionId={}", sessionId);
        }
    }
}
