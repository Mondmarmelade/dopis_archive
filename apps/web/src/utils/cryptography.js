import CryptoJS from "crypto-js";

const getSecretKey = () => {
  const key =
    (typeof import.meta !== "undefined" && import.meta.env?.SECRET_KEY) ||
    process.env.SECRET_KEY;

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: SECRET_KEY environment variable is mandatory in production."
      );
    }
    console.warn(
      "SECURITY WARNING: SECRET_KEY is not set! Using development fallback key."
    );
    return "dopis-dev-fallback-key-do-not-use-in-production-12345";
  }
  return key;
};

export function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), getSecretKey()).toString();
}

export function decryptData(encryptedData) {
  if (!encryptedData || typeof encryptedData !== "string") {
    return null;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, getSecretKey());
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) {
      return null;
    }
    return JSON.parse(decryptedStr);
  } catch (err) {
    return null;
  }
}
