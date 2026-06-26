package com.im.sys.model;

import java.util.List;

public class WebSocketMessage {

    public static final String TYPE_REGISTER = "REGISTER";
    public static final String TYPE_ONLINE_USERS = "ONLINE_USERS";
    public static final String TYPE_CREATE_SESSION = "CREATE_SESSION";
    public static final String TYPE_SESSION_CREATED = "SESSION_CREATED";
    public static final String TYPE_SESSION_REQUEST = "SESSION_REQUEST";
    public static final String TYPE_SESSION_ACCEPT = "SESSION_ACCEPT";
    public static final String TYPE_KEY_EXCHANGE = "KEY_EXCHANGE";
    public static final String TYPE_CHAT = "CHAT";

    private String type;
    private String from;
    private String to;
    private String sessionId;
    private String step;
    private String random;
    private String encAlgo;
    private String hashAlgo;
    private String iv;
    private String ciphertext;
    private String hashValue;
    private String hmacTag;
    private String authTag;
    private String messageType;  // "text" 或 "image"
    private String fileName;     // 图片原始文件名（仅image类型）
    private List<String> users;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getTo() {
        return to;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getStep() {
        return step;
    }

    public void setStep(String step) {
        this.step = step;
    }

    public String getRandom() {
        return random;
    }

    public void setRandom(String random) {
        this.random = random;
    }

    public String getEncAlgo() {
        return encAlgo;
    }

    public void setEncAlgo(String encAlgo) {
        this.encAlgo = encAlgo;
    }

    public String getHashAlgo() {
        return hashAlgo;
    }

    public void setHashAlgo(String hashAlgo) {
        this.hashAlgo = hashAlgo;
    }

    public String getIv() {
        return iv;
    }

    public void setIv(String iv) {
        this.iv = iv;
    }

    public String getCiphertext() {
        return ciphertext;
    }

    public void setCiphertext(String ciphertext) {
        this.ciphertext = ciphertext;
    }

    public String getHashValue() {
        return hashValue;
    }

    public void setHashValue(String hashValue) {
        this.hashValue = hashValue;
    }

    public String getHmacTag() {
        return hmacTag;
    }

    public void setHmacTag(String hmacTag) {
        this.hmacTag = hmacTag;
    }

    public String getAuthTag() {
        return authTag;
    }

    public void setAuthTag(String authTag) {
        this.authTag = authTag;
    }

    public String getMessageType() {
        return messageType;
    }

    public void setMessageType(String messageType) {
        this.messageType = messageType;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public List<String> getUsers() {
        return users;
    }

    public void setUsers(List<String> users) {
        this.users = users;
    }
}