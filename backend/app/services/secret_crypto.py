import base64
import hashlib
import os


def _secret_key() -> str:
    key = os.getenv("USER_AGENT_CONFIG_ENCRYPTION_KEY", "").strip()
    if not key:
        raise RuntimeError("Missing USER_AGENT_CONFIG_ENCRYPTION_KEY")
    return key


def _xor_bytes(data: bytes, key: bytes) -> bytes:
    out = bytearray(len(data))
    for i, b in enumerate(data):
        out[i] = b ^ key[i % len(key)]
    return bytes(out)


def encrypt_secret(plain: str) -> str:
    material = hashlib.sha256(_secret_key().encode("utf-8")).digest()
    encrypted = _xor_bytes(plain.encode("utf-8"), material)
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def decrypt_secret(cipher_text: str) -> str:
    material = hashlib.sha256(_secret_key().encode("utf-8")).digest()
    raw = base64.urlsafe_b64decode(cipher_text.encode("utf-8"))
    return _xor_bytes(raw, material).decode("utf-8")
