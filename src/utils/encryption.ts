import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

export const generateKeyPair = () => {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: util.encodeBase64(keyPair.publicKey),
    secretKey: util.encodeBase64(keyPair.secretKey),
  };
};

export const encrypt = (message: string, theirPublicKey: string, mySecretKey: string) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = util.decodeUTF8(message);
  const encrypted = nacl.box(
    messageUint8,
    nonce,
    util.decodeBase64(theirPublicKey),
    util.decodeBase64(mySecretKey)
  );

  const fullMessage = new Uint8Array(nonce.length + encrypted.length);
  fullMessage.set(nonce);
  fullMessage.set(encrypted, nonce.length);

  return util.encodeBase64(fullMessage);
};

export const decrypt = (messageWithNonce: string, theirPublicKey: string, mySecretKey: string) => {
  const messageWithNonceAsUint8Array = util.decodeBase64(messageWithNonce);
  const nonce = messageWithNonceAsUint8Array.slice(0, nacl.box.nonceLength);
  const message = messageWithNonceAsUint8Array.slice(
    nacl.box.nonceLength,
    messageWithNonce.length
  );

  const decrypted = nacl.box.open(
    message,
    nonce,
    util.decodeBase64(theirPublicKey),
    util.decodeBase64(mySecretKey)
  );

  if (!decrypted) {
    throw new Error('Could not decrypt message');
  }

  return util.encodeUTF8(decrypted);
};