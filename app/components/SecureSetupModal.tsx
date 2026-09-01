"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, Hash, Key, Shield, Trash2, X } from "lucide-react";
import { encryptContent } from "../lib/crypto";
import type { SecurityConfig } from "../lib/types";

type Props = {
  currentContent: string;
  initialSecurity?: SecurityConfig;
  onSave: (config: SecurityConfig | null, newPasscode?: string) => void;
  onClose: () => void;
};

export function SecureSetupModal({ currentContent, initialSecurity, onSave, onClose }: Props) {
  const [lockType, setLockType] = useState<"pin" | "password">(initialSecurity?.lockType ?? "pin");
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [hint, setHint] = useState(initialSecurity?.hint ?? "");
  const [autoLockOnClose, setAutoLockOnClose] = useState(initialSecurity?.autoLockOnClose ?? true);
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(initialSecurity);

  useEffect(() => {
    inputRef.current?.focus();
  }, [lockType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (lockType === "pin") {
      if (!/^\d{4,6}$/.test(passcode)) {
        setError("O PIN deve conter de 4 a 6 dígitos numéricos.");
        return;
      }
    } else {
      if (passcode.length < 4) {
        setError("A senha deve conter no mínimo 4 caracteres.");
        return;
      }
    }

    if (passcode !== confirmPasscode) {
      setError("Os códigos de confirmação não coincidem.");
      return;
    }

    setBusy(true);
    try {
      // Criptografar o conteúdo atual com a nova chave
      const encrypted = await encryptContent(currentContent, passcode);

      const newConfig: SecurityConfig = {
        isLocked: false, // Começa desbloqueada na sessão atual
        lockType,
        salt: encrypted.salt,
        iv: encrypted.iv,
        encryptedPayload: encrypted.encryptedPayload,
        hash: encrypted.hash,
        hint: hint.trim() || undefined,
        autoLockOnClose,
      };

      onSave(newConfig, passcode);
      onClose();
    } catch {
      setError("Erro ao gerar criptografia da nota. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveProtection() {
    if (confirm("Tem certeza que deseja remover a proteção por senha desta nota? O conteúdo ficará visível sem bloqueio.")) {
      onSave(null);
      onClose();
    }
  }

  return (
    <div className="modal-layer">
      <button className="scrim" onClick={onClose} aria-label="Fechar modal" />
      <section className="secure-setup-panel">
        <button className="modal-close" onClick={onClose} title="Fechar">
          <X size={19} />
        </button>

        <div className="setup-header">
          <div className="setup-icon-box">
            <Shield size={24} />
          </div>
          <div>
            <span className="modal-kicker">COFRE PESSOAL</span>
            <h2>{isEditing ? "Configurações de Segurança" : "Proteger com Senha ou PIN"}</h2>
            <p>
              Criptografe esta nota com proteção local. O conteúdo só poderá ser acessado com o código definido.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="lock-type-selector">
            <button
              type="button"
              className={`type-card ${lockType === "pin" ? "active" : ""}`}
              onClick={() => {
                setLockType("pin");
                setPasscode("");
                setConfirmPasscode("");
                setError("");
              }}
            >
              <Hash size={20} />
              <strong>PIN Numérico</strong>
              <small>4 a 6 dígitos rápidos</small>
            </button>

            <button
              type="button"
              className={`type-card ${lockType === "password" ? "active" : ""}`}
              onClick={() => {
                setLockType("password");
                setPasscode("");
                setConfirmPasscode("");
                setError("");
              }}
            >
              <Key size={20} />
              <strong>Senha Texto</strong>
              <small>Alfanumérica personalizada</small>
            </button>
          </div>

          <div className="setup-fields">
            <label>
              {lockType === "pin" ? "Defina o PIN (4 a 6 dígitos)" : "Defina a Senha"}
              <div className="input-with-icon">
                <input
                  ref={inputRef}
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (lockType === "pin") {
                      if (/^\d*$/.test(val) && val.length <= 6) setPasscode(val);
                    } else {
                      setPasscode(val);
                    }
                    setError("");
                  }}
                  placeholder={lockType === "pin" ? "Ex: 1234" : "Digite sua senha segura..."}
                  required
                />
                <button
                  type="button"
                  className="toggle-vis-btn"
                  onClick={() => setShowPasscode(!showPasscode)}
                  tabIndex={-1}
                >
                  {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label>
              Confirmar {lockType === "pin" ? "PIN" : "Senha"}
              <div className="input-with-icon">
                <input
                  type={showPasscode ? "text" : "password"}
                  value={confirmPasscode}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (lockType === "pin") {
                      if (/^\d*$/.test(val) && val.length <= 6) setConfirmPasscode(val);
                    } else {
                      setConfirmPasscode(val);
                    }
                    setError("");
                  }}
                  placeholder="Repita o mesmo código"
                  required
                />
              </div>
            </label>

            <label>
              Dica para lembrar o código (Opcional)
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="Ex: Ano de formatura ou palavra-chave..."
                maxLength={60}
              />
              <small>Esta dica fica visível na tela de desbloqueio para ajudar você a se lembrar.</small>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoLockOnClose}
                onChange={(e) => setAutoLockOnClose(e.target.checked)}
              />
              <span>Bloquear automaticamente sempre que fechar a nota</span>
            </label>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="setup-actions">
            {isEditing && (
              <button
                type="button"
                className="remove-protection-btn"
                onClick={handleRemoveProtection}
                title="Remover senha desta nota"
              >
                <Trash2 size={16} />
                <span>Remover Proteção</span>
              </button>
            )}

            <button type="submit" className="save-protection-btn" disabled={busy || !passcode || !confirmPasscode}>
              <Check size={16} />
              <span>{busy ? "Criptografando..." : isEditing ? "Salvar Alterações" : "Ativar Proteção"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
