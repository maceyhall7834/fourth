// shard.js

const Eris = require("eris");
const Constants = require("eris").Constants; // Import from the public API

module.exports = function patchShard(Shard) {
  Shard.prototype.identify = function () {
    this.status = "identifying";
    
    const identify = {
      token: this._token,
      v: Constants.GATEWAY_VERSION, // Use GATEWAY_VERSION from Constants
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
    
    this.sendWS(Constants.GatewayOPCodes.IDENTIFY, identify); // Use GatewayOPCodes from Constants
  };
};
