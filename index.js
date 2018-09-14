"use strict";
var Alexa = require('alexa-sdk');
const AlexaDeviceAddressClient = require('./AlexaDeviceAddressClient');
const Messages = require('./Messages');
//var setupEventHandler = require("./SetupEventHandlers")
const APP_ID = "SKILL_ID";

var googleMapsClient = require('@google/maps').createClient({
    key: 'GOOGLEMAPSKEY'
});

const ALL_ADDRESS_PERMISSION = "read::alexa:device:all:address";

const PERMISSIONS = [ALL_ADDRESS_PERMISSION];

var handlers = {
  'LaunchRequest': function () {
      console.log("launch ran")
    this.emit(':ask', 'Where would you like to go?', 'Tell me a place where you would like to go?');
  },
  'MakeSuggestion': function() {
      var self = this;
      var destination = this.event.request.intent.slots.place.value;
      var origin = "DEVICE ADDRESS FOR TESTING";
     
      originGet(self).then(function(result){
        var tosay =result;
        initMap(tosay[0],destination).then(function(result){
          var tosa = result;
          self.emit(':ask', tosa[0])
        })
      })
        
  },
  'GetAddress': function() {
    console.info("Starting getAddressHandler()");

    const consentToken = this.event.context.System.user.permissions.consentToken;

    // If we have not been provided with a consent token, this means that the user has not
    // authorized your skill to access this information. In this case, you should prompt them
    // that you don't have permissions to retrieve their address.
    if(!consentToken) {
        this.emit(":tellWithPermissionCard", "Please enable Location permissions in the Amazon Alexa app.", PERMISSIONS);

        // Lets terminate early since we can't do anything else.
        console.log("User did not give us permissions to access their address.");
        console.info("Ending getAddressHandler()");
        return;
    }

    const deviceId = this.event.context.System.device.deviceId;
    const apiEndpoint = this.event.context.System.apiEndpoint;

    const alexaDeviceAddressClient = new AlexaDeviceAddressClient(apiEndpoint, deviceId, consentToken);
    let deviceAddressRequest = alexaDeviceAddressClient.getFullAddress();

    deviceAddressRequest.then((addressResponse) => {
        switch(addressResponse.statusCode) {
            case 200:
                console.log("Address successfully retrieved, now responding to user.");
                const address = addressResponse.address;

                const ADDRESS_MESSAGE = Messages.ADDRESS_AVAILABLE +
                    `${address['addressLine1']}, ${address['city']}, ${address['stateOrRegion']}, ${address['postalCode']}`;

                this.emit(":tell", ADDRESS_MESSAGE);
                break;
            case 204:
                // This likely means that the user didn't have their address set via the companion app.
                console.log("Successfully requested from the device address API, but no address was returned.");
                this.emit(":tell", Messages.NO_ADDRESS);
                break;
            case 403:
                console.log("The consent token we had wasn't authorized to access the user's address.");
                this.emit(":tellWithPermissionCard", Messages.NOTIFY_MISSING_PERMISSIONS, PERMISSIONS);
                break;
            default:
                this.emit(":ask", Messages.LOCATION_FAILURE, Messages.LOCATION_FAILURE);
        }

        console.info("Ending getAddressHandler()");
    });

    deviceAddressRequest.catch((error) => {
        this.emit(":tell", Messages.ERROR);
        console.error(error);
        console.info("Ending getAddressHandler()");
    });
  },
  'Unhandled': function () {
    this.emit(':tell', 'Sorry, I don\'t know what to do');
  },
  'AMAZON.HelpIntent': function () {
      this.emit(':ask', "What can I help you with?", "How can I help?");
  },
  'AMAZON.CancelIntent': function () {
      this.emit(':tell', "Okay!");
  },
  'AMAZON.StopIntent': function () {
      this.emit(':tell', "Have a safe trip!");
  },
};

function originGet(self) {
  var p1 = new Promise(function(resolve, reject){
     const consentToken = self.event.context.System.user.permissions.consentToken;
    if(!consentToken) {
        // this.emit(":tellWithPermissionCard", "Please enable Location permissions in the Amazon Alexa app.", PERMISSIONS);
        console.log("User did not give us permissions to access their address.");
        console.info("Ending getAddressHandler()");
        reject;
    }
    const deviceId = self.event.context.System.device.deviceId;
    const apiEndpoint = self.event.context.System.apiEndpoint;
    const alexaDeviceAddressClient = new AlexaDeviceAddressClient(apiEndpoint, deviceId, consentToken);
    let deviceAddressRequest = alexaDeviceAddressClient.getFullAddress();
    deviceAddressRequest.then((addressResponse) => {
        switch(addressResponse.statusCode) {
            case 200:
                console.log("Address successfully retrieved, now responding to user.");
                const address = addressResponse.address;

                const ADDRESS_MESSAGE = Messages.ADDRESS_AVAILABLE +
                    `${address['addressLine1']}, ${address['stateOrRegion']}, ${address['postalCode']}`;
                var res = `${address['addressLine1']}`;

                // this.emit(":tell", ADDRESS_MESSAGE);
                resolve([res])
            case 204:
                // This likely means that the user didn't have their address set via the companion app.
                console.log("Successfully requested from the device address API, but no address was returned.");
               // this.emit(":tell", Messages.NO_ADDRESS);
                reject
            case 403:
                console.log("The consent token we had wasn't authorized to access the user's address.");
                //this.emit(":tellWithPermissionCard", Messages.NOTIFY_MISSING_PERMISSIONS, PERMISSIONS);
                reject
            default:
                //this.emit(":ask", Messages.LOCATION_FAILURE, Messages.LOCATION_FAILURE);
        }

        console.info("Ending getAddressHandler()");
    });

    deviceAddressRequest.catch((error) => {
        // this.emit(":tell", Messages.ERROR);
        console.error(error);
        console.info("Ending getAddressHandler()");
    });
  })
  return p1
}
function initMap(origin, destination) {
    var p1 = new Promise(function(resolve, reject){
            googleMapsClient.directions({
            origin: JSON.stringify(origin),
            destination: JSON.stringify(destination),
            mode: 'transit'
          }, function(err, response) {
            if (!err) {
              // var depature_time = response.json.routes[0].legs[0].departure_time.text;
              var steps = response.json.routes[0].legs[0].steps;
              var departure_instructions = steps[0].html_instructions;
              var departure_bus = steps[1].transit_details.line.short_name+" "+steps[1].transit_details.headsign+" "+steps[1].transit_details.line.name;
              var res = departure_instructions + " at " + response.json.routes[0].legs[0].departure_time.text + " and take " + departure_bus+", and arrive at "+steps[1].transit_details.arrival_stop.name+" at "+steps[1].transit_details.arrival_time.text;
              //console.log(cleanData(res.json.routes[0]['legs'][0]['steps'])[0])
              resolve([res])
            } else {
                console.log(err);
                console.log("error in getting route");
              // console.log(err)
              // console.log(response.json.results);
              // alexa.emit(":tell", "Sorry I couldn't find the route for you.");
              // result = err;
            }
          });
      })
    return p1
}
exports.handler = function(event, context, callback){
  var alexa = Alexa.handler(event, context);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
