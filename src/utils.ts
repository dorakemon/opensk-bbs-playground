export const printHex = (data: Uint8Array) => {
  const hexString = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
  console.log(hexString);
  return hexString;
}

export const hexToUint8Array = (hexString: string): Uint8Array => {
  const paddedHexString = hexString.length % 2 === 0 ? hexString : '0' + hexString;
  const numbers = paddedHexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) ?? [];
  return new Uint8Array(numbers);
}

export const appendBuffer = (buffer1: Uint8Array, buffer2: Uint8Array) => {
  const tmp = new Uint8Array(buffer1.length + buffer2.length);
  tmp.set(buffer1, 0);
  tmp.set(buffer2, buffer1.length);
  return tmp;
}