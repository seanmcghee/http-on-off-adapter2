/**
 * http-on-off-adapter2.js - OnOff adapter implemented as a plugin.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const fetch = require('node-fetch');
var mqtt = require('mqtt');

let Adapter, Device, Property;
try {
  Adapter = require('../adapter');
  Device = require('../device');
  Property = require('../property');
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    throw e;
  }

  const gwa = require('gateway-addon');
  Adapter = gwa.Adapter;
  Device = gwa.Device;
  Property = gwa.Property;
}

class HttpOnOffProperty2 extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;

    // In an ideal world, we would query the device and return
    // it's value.
    //console.log('http-on-off-adapter2.js property constructor. Device:', device, 'Name:', name, 'PropertyDescription:', propertyDescription);
    //this.setCachedValue(this.getValue());
    //console.log('http-on-off-adapter2.js notifying property changed');
    //this.device.notifyPropertyChanged(this);
    var thisproperty = this;
    this.getValue().then(function(result) {
        console.log('http-on-off-adapter2.js getValue() returned result:', result);
        thisproperty.setCachedValue(result);
        console.log('http-on-off-adapter2.js notifying property changed');
        thisproperty.device.notifyPropertyChanged(thisproperty);
        console.log('http-on-off-adapter2.js Setting property via Promise worked'); 
    }, function(err) {
        console.error('Setting property via Promise failed'); 
        console.error(err);
        throw err;
    });
  }

  /**
   * @method setValue
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve, reject) => {
      
      let mqttTopic = 'cmd/' + this.device.mqttid + '/POWER';
      let mqttPayload = '';
      
      if (value) {
        //turn light on
        mqttPayload = 'ON';
      } else {
        //turn light off
        mqttPayload = 'OFF';
      }
      
      var client = mqtt.connect({ port: 1883, host: '192.168.0.2', username: 'admin', password: 'sm681600', keepalive: 10000});
      console.log('MQQT Client connected');
      
      try {
      
        console.log('About to publish to MQQT Client. Topic:',mqttTopic, 'Payload:', mqttPayload);
        
        client.on('connect', function () {
            client.publish(mqttTopic, mqttPayload);
            console.log('Published to MQQT Client. Topic:',mqttTopic, 'Payload:', mqttPayload);
            client.end(); 
            console.log('MQQT Client disconnected');
        })
        
        
        this.setCachedValue(value);
        console.log('Property:', this.name, 'set to:', mqttPayload, 'using topic:', mqttTopic);
        resolve(value);
        this.device.notifyPropertyChanged(this);
        
      } catch (e) {
        console.error('Request to mqtt topic:', mqttTopic, 'failed');
        console.error(e);
        reject(e);
      }

            
    });
  }
  /**
   * @method getValue
   * @returns a promise which resolves to the value of this property
   *
   */
  getValue() {
    return new Promise((resolve, reject) => {
      
      let mqttPublishTopic = 'cmd/' + this.device.mqttid + '/POWER';
      let mqttSubscribeTopic = 'stat/' + this.device.mqttid + '/POWER';
      let mqttPayload = '';
      let value = false;
            
      var client = mqtt.connect({ port: 1883, host: '192.168.0.2', username: 'XXXXX', password: 'xx----00', keepalive: 10000});
      console.log('MQQT Client connected');
      
      try {
      
        console.log('About to publish to MQQT Client. Topic:', mqttPublishTopic, 'Payload:', mqttPayload);
        
        client.on('connect', function () {
            client.subscribe(mqttSubscribeTopic);
            console.log('Subscribed to MQQT Client. Topic:',mqttSubscribeTopic);
            client.publish(mqttPublishTopic, mqttPayload);
            console.log('Published to MQQT Client. Topic:',mqttPublishTopic, 'Payload:', mqttPayload); 
        })
        
        client.on('message', function (topic, message) {
            // message is Buffer    
            let  powerStatus = message.toString();
            console.log('Message recieved by MQQT Client. Topic:', topic, 'Payload:', powerStatus);   
            client.end(); 
            console.log('MQQT Client disconnected');
            if ('ON' == powerStatus) {
                value = true;
                console.log('getValue() about to return value:', value);
            }
            
            resolve(value);
        })
                
      } catch (e) {
      
        console.error('Request to publish to mqtt topic:', mqttPublishTopic, 'or subscribe to mqqt topic:', mqttSubscribeTopic, 'failed');
        console.error(e);
        
        reject(e);
      }

            
    });
  }
}
      

class HttpOnOffDevice2 extends Device {
  constructor(adapter, id, mqttid) {
    super(adapter, id);

    this.name = 'Light ' + mqttid;
    this.type = 'onOffLight';
    this.description = 'Simple HTTP OnOff Light';
    this.mqttid = mqttid;

    console.log('Device MQTT Id:', mqttid, 'added');

    this.properties.set('on', new HttpOnOffProperty2(this, 'on', {
      type: 'boolean',
      value: false,
    }));
  }
}

class HttpOnOffAdapter2 extends Adapter {
  constructor(addonManager, packageName) {
    super(addonManager, 'HttpOnOffAdapter2', packageName);
    addonManager.addAdapter(this);
  }
  
  /**
   *
   * Cancel pairing triggered so refresh on-off properties of existing devices
   * 
  */
  cancelPairing() {
    console.log('Http-On-Off-Adapter:', this.name, 'id', this.id, 'refreshing device properties');
        
    for (var deviceId in this.devices) {
      var refreshDevice = this.getDevice(deviceId);
      console.log('About to refresh on property for device', refreshDevice.name);
      //console.log('Device properties', refreshDevice.properties);
      
      refreshDevice.properties.forEach((refreshProperty, refreshPropertyName) => {
      
        console.log('About to refresh property name', refreshPropertyName);
        
        if (refreshProperty !== null) {
          console.log('With property definition', refreshProperty);
          
          refreshProperty.getValue().then(function(result) {
            console.log('http-on-off-adapter2.js property refresh getValue() returned result:', result);
            refreshProperty.setCachedValue(result);
            console.log('http-on-off-adapter2.js notifying property changed');
            refreshProperty.device.notifyPropertyChanged(refreshProperty);
            console.log('http-on-off-adapter2.js Setting property via Promise worked'); 
          }, function(err) {
            console.error('Refreshing property value via Promise failed'); 
            console.error(err);
            throw err;
          });
        }
      });   //for each property in map   
    } //for each device in adapter
  } //end of cancelPairing method

}

function loadHttpOnOffAdapter2(addonManager, manifest, _errorCallback) {
  let adapter = new HttpOnOffAdapter2(addonManager, manifest.name);

  adapter.handleDeviceAdded(new HttpOnOffDevice2(adapter,
                                                'HttpOnOffDevice2-01',
                                                "sonoff"));
                                                
  adapter.handleDeviceAdded(new HttpOnOffDevice2(adapter,
                                                'HttpOnOffDevice2-02',
                                                "sonoff2"));
  
  adapter.handleDeviceAdded(new HttpOnOffDevice2(adapter,
                                                'HttpOnOffDevice2-03',
                                                "sonoff3"));
}

module.exports = loadHttpOnOffAdapter2;
