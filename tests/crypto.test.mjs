import assert from "node:assert/strict";
import test from "node:test";
import {
  encryptContent,
  decryptContent,
  computePasscodeHash,
  verifyPasscodeWithHash,
} from "../app/lib/crypto.ts";

test("encryptContent and decryptContent with correct PIN (4 digits)", async () => {
  const secretText = "# Meu Segredo\n\nEsta é uma anotação estritamente confidencial.";
  const pin = "4829";

  const encrypted = await encryptContent(secretText, pin);

  assert.ok(encrypted.encryptedPayload, "Should produce encryptedPayload");
  assert.ok(encrypted.iv, "Should produce iv");
  assert.ok(encrypted.salt, "Should produce salt");
  assert.ok(encrypted.hash, "Should produce hash");
  assert.notEqual(encrypted.encryptedPayload, secretText, "Ciphertext must not be plaintext");

  const decrypted = await decryptContent(
    encrypted.encryptedPayload,
    encrypted.iv,
    encrypted.salt,
    pin
  );

  assert.equal(decrypted, secretText, "Decrypted text must match original plaintext");
});

test("encryptContent and decryptContent with alphanumeric password", async () => {
  const secretText = "Chave Secreta: 9f823a-bc44-4821-b0e1-789a42cd99f1";
  const password = "SuperSecretPassword123!@#";

  const encrypted = await encryptContent(secretText, password);
  const decrypted = await decryptContent(
    encrypted.encryptedPayload,
    encrypted.iv,
    encrypted.salt,
    password
  );

  assert.equal(decrypted, secretText);
});

test("decryptContent fails with wrong PIN/password", async () => {
  const secretText = "Informações bancárias confidenciais";
  const correctPin = "9988";
  const wrongPin = "1122";

  const encrypted = await encryptContent(secretText, correctPin);

  await assert.rejects(
    async () => {
      await decryptContent(
        encrypted.encryptedPayload,
        encrypted.iv,
        encrypted.salt,
        wrongPin
      );
    },
    /Senha ou PIN incorreto/
  );
});

test("verifyPasscodeWithHash correctly validates valid and invalid passcodes", async () => {
  const pin = "1234";
  const wrongPin = "4321";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await computePasscodeHash(pin, salt);

  const saltBase64 = Buffer.from(salt).toString("base64");

  const isValid = await verifyPasscodeWithHash(pin, saltBase64, hash);
  const isInvalid = await verifyPasscodeWithHash(wrongPin, saltBase64, hash);

  assert.equal(isValid, true, "Valid PIN should return true");
  assert.equal(isInvalid, false, "Invalid PIN should return false");
});
