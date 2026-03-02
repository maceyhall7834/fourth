// shard.js

const Eris = require("eris");
const Constants = require('eris/lib/Constants');
const { GATEWAY_VERSION, GatewayOPCodes } = Constants;

module.exports = function patchShard(Shard) {
  Shard.prototype.identify = function () {
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
    if (this.presence.status) {
      identify.presence = this.presence;
    }
    this.sendWS(GatewayOPCodes.IDENTIFY, identify);
  };
};
