---
name: Passlib + bcrypt incompatibility
description: passlib's bcrypt backend breaks with modern bcrypt versions, causing password hashing to fail.
---

`passlib.context.CryptContext(schemes=["bcrypt"])` (passlib 1.7.4) probes `bcrypt.__about__.__version__` to detect the backend version. That attribute was removed in `bcrypt` >= 4.1. The probe fails silently ("(trapped) error reading bcrypt version"), passlib then runs a bug-detection routine that misbehaves and raises `ValueError: password cannot be longer than 72 bytes` on ordinary passwords.

**Why:** Hit this building a FastAPI backend with `passlib[bcrypt]` + `bcrypt` installed together via the normal package manager, which pulls a recent bcrypt release incompatible with passlib's shim.

**How to apply:** For new Python backends needing password hashing, use the `bcrypt` package directly (`bcrypt.hashpw` / `bcrypt.checkpw`, truncating input to 72 bytes) instead of `passlib.CryptContext`. Skip passlib entirely unless a project already depends on it and has pinned compatible versions.
