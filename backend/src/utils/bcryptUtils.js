const bcrypt = require('bcryptjs');

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  if (!password || !hashedPassword) return false;

  const normalizedPassword = String(password).trim();
  const normalizedHash = String(hashedPassword).trim();

  if (!normalizedPassword || !normalizedHash) return false;

  if (!isBcryptHash(normalizedHash)) {
    return normalizedPassword === normalizedHash;
  }

  return await bcrypt.compare(normalizedPassword, normalizedHash);
};

module.exports = { hashPassword, comparePassword };