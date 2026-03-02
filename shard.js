// shard.js
// patch Eris's Shard.identify method so Discord treats the connection as mobile
// (overrides default "Eris"/"web" fields). This patch is applied when
// the module is loaded.

module.exports = function patchShard() {
  try {
    const { Constants, Shard } = require('eris');
    const { GATEWAY_VERSION, GatewayOPCodes } = Constants;

    Shard.prototype.identify = function () {
      // same logic as upstream, but with mobile device properties
      this.status = "identifying";
      const identify = {
        token: this._token,
        v: GATEWAY_VERSION,
        compress: !!this.client.options.compress,
        large_threshold: this.client.options.largeThreshold,
        intents: this.client.options.intents,
        properties: {
          os: "Android",
          browser: "Discord Android",
          device: "mobile",
        },
      };
      if (this.client.options.maxShards > 1) {
        identify.shard = [this.id, this.client.options.maxShards];
      }
      if (this.presence.status) identify.presence = this.presence;
      this.sendWS(GatewayOPCodes.IDENTIFY, identify);
    };
  } catch (e) {
    // if Eris internals change or module can't be loaded, warn and continue
    console.warn('Could not patch Shard.identify for mobile device', e);
  }
};
