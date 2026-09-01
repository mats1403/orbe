/**
 * Orbe — Módulo de Criptografia Local (Zero-Knowledge)
 * Utiliza Web Crypto API nativa (AES-GCM 256 bits + PBKDF2 com SHA-256).
 */

export type EncryptedResult = {
  encryptedPayload: string; // Base64
  iv: string; // Base64
  salt: string; // Base64
  hash: string; // Base64 (para validação rápida de senha)
};

// Conversões de ArrayBuffer para Base64 e vice-versa
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Deriva uma chave de criptografia AES-GCM (256 bits) a partir de uma senha/PIN e um salt usando PBKDF2.
 */
async function deriveKey(passcode: string, salt: Uint8Array, usage: KeyUsage[] = ["encrypt", "decrypt"]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as ArrayBuffer,
      iterations: 100_000,
      hash: "SHA-256",
    },
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    usage
  );
}

/**
 * Gera um hash SHA-256 da senha combinada com o salt para verificação rápida.
 */
export async function computePasscodeHash(passcode: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const combined = new Uint8Array(salt.length + enc.encode(passcode).length);
  combined.set(salt, 0);
  combined.set(enc.encode(passcode), salt.length);

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return bufferToBase64(digest);
}

/**
 * Criptografa um texto em claro com uma senha ou PIN.
 */
export async function encryptContent(plainText: string, passcode: string): Promise<EncryptedResult> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt, ["encrypt"]);

  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plainText)
  );

  const hash = await computePasscodeHash(passcode, salt);

  return {
    encryptedPayload: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    hash,
  };
}

/**
 * Decifra o conteúdo cifrado utilizando a senha ou PIN.
 * Lança erro se a senha estiver incorreta ou a integridade dos dados for violada.
 */
export async function decryptContent(
  encryptedPayload: string,
  ivBase64: string,
  saltBase64: string,
  passcode: string
): Promise<string> {
  const salt = base64ToBuffer(saltBase64);
  const iv = base64ToBuffer(ivBase64);
  const cipherBytes = base64ToBuffer(encryptedPayload);

  const key = await deriveKey(passcode, salt, ["decrypt"]);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
      key,
      cipherBytes as unknown as ArrayBuffer
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Senha ou PIN incorreto.");
  }
}

/**
 * Valida se um PIN ou senha fornecido bate com o hash registrado.
 */
export async function verifyPasscodeWithHash(passcode: string, saltBase64: string, expectedHash: string): Promise<boolean> {
  try {
    const salt = base64ToBuffer(saltBase64);
    const calculatedHash = await computePasscodeHash(passcode, salt);
    return calculatedHash === expectedHash;
  } catch {
    return false;
  }
}
