"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Delete, Eye, EyeOff, HelpCircle, KeyRound, Lock, ShieldCheck, Unlock } from "lucide-react";
import { decryptContent, verifyPasscodeWithHash } from "../lib/crypto";
import type { OrbeDocument } from "../lib/types";

type Props = {
  document: OrbeDocument;
  onUnlock: (decryptedContent: string, passcode: string) => void;
  onCancel: () => void;
};

export function SecureUnlockModal({ document, onUnlock, onCancel }: Props) {
  const security = document.security;
  const lockType = security?.lockType ?? "pin";
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const maxPinLength = 6;

  useEffect(() => {
    if (lockType === "password") {
      passwordInputRef.current?.focus();
    }
  }, [lockType]);

  const attemptUnlock = useCallback(async (passcodeToTry: string) => {
    if (!security || !security.encryptedPayload) {
      onUnlock(document.content ?? "", passcodeToTry);
      return;
    }

    setUnlocking(true);
    setError("");

    try {
      if (security.hash && security.salt) {
        const isValid = await verifyPasscodeWithHash(passcodeToTry, security.salt, security.hash);
        if (!isValid) {
          throw new Error("Senha ou PIN incorreto.");
        }
      }

      const decrypted = await decryptContent(
        security.encryptedPayload,
        security.iv,
        security.salt,
        passcodeToTry
      );

      onUnlock(decrypted, passcodeToTry);
    } catch {
      setIsShaking(true);
      setError(lockType === "pin" ? "PIN incorreto. Tente novamente." : "Senha incorreta. Tente novamente.");
      setPin("");
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setUnlocking(false);
    }
  }, [document.content, lockType, onUnlock, security]);

  const handlePinDigit = useCallback((digit: string) => {
    if (pin.length >= maxPinLength || unlocking) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError("");

    if (nextPin.length === 4 || nextPin.length === 6) {
      setTimeout(() => {
        attemptUnlock(nextPin);
      }, 120);
    }
  }, [attemptUnlock, pin, unlocking]);

  const handlePinBackspace = useCallback(() => {
    if (unlocking) return;
    setPin((prev) => prev.slice(0, -1));
    setError("");
  }, [unlocking]);

  const handlePinClear = useCallback(() => {
    if (unlocking) return;
    setPin("");
    setError("");
  }, [unlocking]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
        return;
      }

      if (lockType === "pin") {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handlePinDigit(e.key);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          handlePinBackspace();
        } else if (e.key === "Enter" && pin.length >= 4) {
          e.preventDefault();
          attemptUnlock(pin);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [attemptUnlock, handlePinBackspace, handlePinDigit, lockType, onCancel, pin]);

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || unlocking) return;
    attemptUnlock(password);
  }

  return (
    <div className="secure-unlock-screen">
      <div className={`secure-unlock-box ${isShaking ? "shake-error" : ""}`}>
        <button className="secure-cancel-button" onClick={onCancel} title="Voltar ao início">
          <ArrowLeft size={18} />
          <span>Voltar</span>
        </button>

        <div className="secure-shield-badge">
          <div className="shield-icon-glow">
            <Lock size={28} />
          </div>
          <span className="secure-pill-tag">
            <ShieldCheck size={13} />
            Nota Criptografada
          </span>
        </div>

        <h2 className="secure-note-title">{document.name}</h2>
        <p className="secure-note-subtitle">
          {lockType === "pin"
            ? "Digite seu PIN de segurança para desbloquear este cofre"
            : "Insira a senha cadastrada para acessar o conteúdo protegido"}
        </p>

        {lockType === "pin" ? (
          <div className="pin-pad-container">
            <div className="pin-indicators">
              {Array.from({ length: 6 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`pin-dot ${idx < pin.length ? "filled" : ""} ${
                    unlocking ? "pulsing" : ""
                  }`}
                />
              ))}
            </div>

            {error && <div className="secure-error-message">{error}</div>}

            <div className="pin-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="pin-key"
                  onClick={() => handlePinDigit(String(num))}
                  disabled={unlocking}
                >
                  <span>{num}</span>
                </button>
              ))}
              <button
                type="button"
                className="pin-key pin-key-action"
                onClick={handlePinClear}
                title="Limpar PIN"
                disabled={pin.length === 0 || unlocking}
              >
                <small>Limpar</small>
              </button>
              <button
                type="button"
                className="pin-key"
                onClick={() => handlePinDigit("0")}
                disabled={unlocking}
              >
                <span>0</span>
              </button>
              <button
                type="button"
                className="pin-key pin-key-action"
                onClick={handlePinBackspace}
                title="Apagar"
                disabled={pin.length === 0 || unlocking}
              >
                <Delete size={18} />
              </button>
            </div>
          </div>
        ) : (
          <form className="password-unlock-form" onSubmit={handlePasswordSubmit}>
            <div className="password-input-group">
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                placeholder="Digite a senha da nota..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                disabled={unlocking}
              />
              <button
                type="button"
                className="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && <div className="secure-error-message">{error}</div>}

            <button
              type="submit"
              className="secure-submit-btn"
              disabled={!password || unlocking}
            >
              {unlocking ? (
                <>
                  <span className="spinner-mini" />
                  <span>Decifrando...</span>
                </>
              ) : (
                <>
                  <Unlock size={16} />
                  <span>Desbloquear Nota</span>
                </>
              )}
            </button>
          </form>
        )}

        {security?.hint && (
          <div className="secure-hint-section">
            {!showHint ? (
              <button
                type="button"
                className="secure-hint-toggle"
                onClick={() => setShowHint(true)}
              >
                <HelpCircle size={14} />
                <span>Exibir dica de senha</span>
              </button>
            ) : (
              <div className="secure-hint-card">
                <KeyRound size={14} />
                <div>
                  <strong>Dica de recuperação:</strong>
                  <p>{security.hint}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="secure-encryption-footnote">
          <Lock size={12} />
          <span>Criptografia AES-GCM 256-bit ponta a ponta</span>
        </div>
      </div>
    </div>
  );
}
