export class FIDOKeyHIDDevice {
  device: HIDDevice;

  constructor(device: HIDDevice) {
    this.device = device;
  }

  async open() {
    if (!this.device.opened)
      await this.device.open();
  }

  static async listDevices(vendorId: number, productId: number): Promise<HIDDevice[]> {
    return await navigator.hid.requestDevice({
      filters: [
        { vendorId, productId }
      ]
    });
  }

  get deviceInfo(): string {
    return `VendorID: ${this.device.vendorId}, ProductID: ${this.device.productId}, ProductName: ${this.device.productName}`;
  }
}
