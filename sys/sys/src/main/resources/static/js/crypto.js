// ==============================
// Crypto Library: DH + AES + HMAC
// ==============================

const DH_P_HEX = "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF";
const DH_P = BigInt("0x" + DH_P_HEX);
const DH_G = 2n;
const DH_KEY_SIZE = 256;

function generateRandomBytes(length) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
}

function generateUUID() {
    return window.crypto.randomUUID();
}

function bigIntToBytes(bigint, length) {
    let hex = bigint.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    const byteLen = hex.length / 2;
    const arr = new Uint8Array(length);
    const offset = length - byteLen;
    for (let i = 0; i < byteLen; i++) {
        arr[offset + i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return arr;
}

function bytesToBigInt(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
    }
    return BigInt("0x" + hex);
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function stringToBytes(str) {
    return new TextEncoder().encode(str);
}

// ============================== DH Key Exchange (RFC 3526 Group 14) ==============================
function generateDHPrivateKey() {
    const bytes = generateRandomBytes(32);
    let priv = bytesToBigInt(bytes);
    if (priv < 2n) priv = 2n;
    if (priv >= DH_P - 2n) priv = priv % (DH_P - 2n);
    return priv;
}

function computeDHPublicKey(privateKey) {
    let result = 1n;
    let base = DH_G % DH_P;
    let exp = privateKey;
    while (exp > 0n) {
        if (exp % 2n === 1n) result = (result * base) % DH_P;
        base = (base * base) % DH_P;
        exp = exp / 2n;
    }
    return result;
}

function computeDHSharedSecret(privateKey, peerPublicKey) {
    let result = 1n;
    let base = peerPublicKey % DH_P;
    let exp = privateKey;
    while (exp > 0n) {
        if (exp % 2n === 1n) result = (result * base) % DH_P;
        base = (base * base) % DH_P;
        exp = exp / 2n;
    }
    return result;
}

// ============================== KDF: SHA-256(share || sessionId) ==============================
function deriveKey(sharedSecret, sessionId) {
    const shareBytes = bigIntToBytes(sharedSecret, DH_KEY_SIZE);
    const sessionIdBytes = stringToBytes(sessionId);
    const combined = new Uint8Array(shareBytes.length + sessionIdBytes.length);
    combined.set(shareBytes, 0);
    combined.set(sessionIdBytes, shareBytes.length);
    const hashWordArray = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(combined));
    const hashHex = hashWordArray.toString(CryptoJS.enc.Hex);
    const aesKeyHex = hashHex.substring(0, 32);
    const hmacKeyHex = hashHex.substring(32, 64);
    const aesKeyWord = CryptoJS.enc.Hex.parse(aesKeyHex);
    const hmacKeyWord = CryptoJS.enc.Hex.parse(hmacKeyHex);
    return {
        aesKey: CryptoJS.enc.Base64.stringify(aesKeyWord),
        hmacKey: CryptoJS.enc.Base64.stringify(hmacKeyWord)
    };
}

// ============================== Hash Functions ==============================
function computeHash(data, hashAlgo) {
    const wordArray = CryptoJS.enc.Utf8.parse(data);
    if (hashAlgo === "MD5") return CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);
    if (hashAlgo === "SHA-1") return CryptoJS.SHA1(wordArray).toString(CryptoJS.enc.Hex);
    throw new Error("Unsupported hash algorithm: " + hashAlgo);
}

function computeHashBase64(base64Data, hashAlgo) {
    const wordArray = CryptoJS.enc.Base64.parse(base64Data);
    if (hashAlgo === "MD5") return CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);
    if (hashAlgo === "SHA-1") return CryptoJS.SHA1(wordArray).toString(CryptoJS.enc.Hex);
    throw new Error("Unsupported hash algorithm: " + hashAlgo);
}

// ============================== AES-128-CBC Encrypt/Decrypt (CryptoJS + HMAC-SHA256) ==============================
function encryptCBC(plaintext, aesKey, hmacKey, hashAlgo) {
    const ivBytes = generateRandomBytes(16);
    const ivBase64 = arrayBufferToBase64(ivBytes);
    const ivWord = CryptoJS.enc.Base64.parse(ivBase64);
    const keyWord = CryptoJS.enc.Base64.parse(aesKey);
    const encrypted = CryptoJS.AES.encrypt(plaintext, keyWord, {
        iv: ivWord,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    const ciphertextBase64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    const hmacKeyWord = CryptoJS.enc.Base64.parse(hmacKey);
    const hmacTag = CryptoJS.HmacSHA256(ciphertextBase64, hmacKeyWord).toString(CryptoJS.enc.Base64);
    const hashValue = computeHashBase64(ciphertextBase64, hashAlgo);
    return { iv: ivBase64, ciphertext: ciphertextBase64, hashValue: hashValue, hmacTag: hmacTag };
}

function decryptCBC(msgObj, aesKey, hmacKey, hashAlgo) {
    const hmacKeyWord = CryptoJS.enc.Base64.parse(hmacKey);
    const expectedHmac = CryptoJS.HmacSHA256(msgObj.ciphertext, hmacKeyWord).toString(CryptoJS.enc.Base64);
    if (expectedHmac !== msgObj.hmacTag) {
        throw new Error("HMAC verification failed: message may be tampered or key error");
    }
    const expectedHash = computeHashBase64(msgObj.ciphertext, hashAlgo);
    if (expectedHash !== msgObj.hashValue) {
        throw new Error("Hash verification failed: integrity check failed");
    }
    const keyWord = CryptoJS.enc.Base64.parse(aesKey);
    const ivWord = CryptoJS.enc.Base64.parse(msgObj.iv);
    const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(msgObj.ciphertext)
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWord, {
        iv: ivWord,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

// ============================== AES-128-GCM Encrypt/Decrypt (Web Crypto API) ==============================
async function encryptGCM(plaintext, aesKey, hashAlgo) {
    const keyBytes = base64ToArrayBuffer(aesKey);
    const nonce = generateRandomBytes(12);
    const cryptoKey = await window.crypto.subtle.importKey(
        "raw", keyBytes, { name: "AES-GCM", length: 128 }, false, ["encrypt"]
    );
    const ptBytes = stringToBytes(plaintext);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce }, cryptoKey, ptBytes
    );
    const encryptedBytes = new Uint8Array(encrypted);
    const ciphertextBytes = encryptedBytes.slice(0, -16);
    const authTagBytes = encryptedBytes.slice(-16);
    const ivBase64 = arrayBufferToBase64(nonce);
    const ciphertextBase64 = arrayBufferToBase64(ciphertextBytes);
    const authTagBase64 = arrayBufferToBase64(authTagBytes);
    const hashValue = computeHashBase64(ciphertextBase64, hashAlgo);
    return { iv: ivBase64, ciphertext: ciphertextBase64, hashValue: hashValue, authTag: authTagBase64 };
}

async function decryptGCM(msgObj, aesKey, hashAlgo) {
    const expectedHash = computeHashBase64(msgObj.ciphertext, hashAlgo);
    if (expectedHash !== msgObj.hashValue) {
        throw new Error("Hash verification failed: integrity check failed");
    }
    const keyBytes = base64ToArrayBuffer(aesKey);
    const nonce = base64ToArrayBuffer(msgObj.iv);
    const ciphertextBytes = base64ToArrayBuffer(msgObj.ciphertext);
    const authTagBytes = base64ToArrayBuffer(msgObj.authTag);
    const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    combined.set(ciphertextBytes, 0);
    combined.set(authTagBytes, ciphertextBytes.length);
    const cryptoKey = await window.crypto.subtle.importKey(
        "raw", keyBytes, { name: "AES-GCM", length: 128 }, false, ["decrypt"]
    );
    try {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: nonce }, cryptoKey, combined
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error("GCM auth tag verification failed: message tampered or key error");
    }
}

// ============================== Unified Encrypt/Decrypt API ==============================
async function encryptAES(plaintext, keyObj, encAlgo, hashAlgo) {
    const baseObj = { iv: "", encAlgo: encAlgo, hashAlgo: hashAlgo, ciphertext: "", hashValue: "", hmacTag: "", authTag: "" };
    if (encAlgo === "CBC") {
        const result = encryptCBC(plaintext, keyObj.aesKey, keyObj.hmacKey, hashAlgo);
        baseObj.iv = result.iv;
        baseObj.ciphertext = result.ciphertext;
        baseObj.hashValue = result.hashValue;
        baseObj.hmacTag = result.hmacTag;
    } else if (encAlgo === "GCM") {
        const result = await encryptGCM(plaintext, keyObj.aesKey, hashAlgo);
        baseObj.iv = result.iv;
        baseObj.ciphertext = result.ciphertext;
        baseObj.hashValue = result.hashValue;
        baseObj.authTag = result.authTag;
    } else {
        throw new Error("Unsupported encryption algorithm: " + encAlgo);
    }
    return baseObj;
}

async function decryptAES(msgObj, keyObj) {
    if (msgObj.encAlgo === "CBC") {
        return decryptCBC(msgObj, keyObj.aesKey, keyObj.hmacKey, msgObj.hashAlgo);
    } else if (msgObj.encAlgo === "GCM") {
        return await decryptGCM(msgObj, keyObj.aesKey, msgObj.hashAlgo);
    } else {
        throw new Error("Unsupported encryption algorithm: " + msgObj.encAlgo);
    }
}

// ============================== Public Namespace ==============================
const CryptoChat = {
    generateKeyPair: function () {
        const privateKey = generateDHPrivateKey();
        const publicKey = computeDHPublicKey(privateKey);
        return { privateKey: privateKey, publicKey: publicKey };
    },
    publicKeyToBase64: function (publicKey) {
        const bytes = bigIntToBytes(publicKey, DH_KEY_SIZE);
        return arrayBufferToBase64(bytes);
    },
    publicKeyFromBase64: function (base64) {
        const bytes = base64ToArrayBuffer(base64);
        return bytesToBigInt(bytes);
    },
    deriveSessionKey: function (privateKey, peerPublicKey, sessionId) {
        const sharedSecret = computeDHSharedSecret(privateKey, peerPublicKey);
        return deriveKey(sharedSecret, sessionId);
    },
    encrypt: encryptAES,
    decrypt: decryptAES,
    generateUUID: generateUUID,
    computeHash: computeHash,
    computeHashBase64: computeHashBase64,
    generateRandomBytes: generateRandomBytes
};

window.CryptoChat = CryptoChat;
