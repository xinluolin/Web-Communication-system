package com.im.sys.model;

// Manual getters/setters — no Lombok

public class ChatSession {
    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_CLOSED = "CLOSED";

    private String sessionId;
    private String userA;
    private String userB;
    private long createTime;
    private String status;

    public ChatSession() {}

    public ChatSession(String sessionId, String userA, String userB) {
        this.sessionId = sessionId;
        this.userA = userA;
        this.userB = userB;
        this.createTime = System.currentTimeMillis();
        this.status = STATUS_ACTIVE;
    }

    // ========== Getters ==========
    public String getSessionId() { return sessionId; }
    public String getUserA() { return userA; }
    public String getUserB() { return userB; }
    public long getCreateTime() { return createTime; }
    public String getStatus() { return status; }

    // ========== Setters ==========
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    public void setUserA(String userA) { this.userA = userA; }
    public void setUserB(String userB) { this.userB = userB; }
    public void setCreateTime(long createTime) { this.createTime = createTime; }
    public void setStatus(String status) { this.status = status; }

    // ========== Business Methods ==========
    public boolean isActive() {
        return STATUS_ACTIVE.equals(status);
    }

    public boolean containsUser(String nickname) {
        return userA.equals(nickname) || userB.equals(nickname);
    }
}