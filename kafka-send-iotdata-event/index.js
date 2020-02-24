const express = require('express');
const kafka = require('kafka-node');
var api = require("@connecthing.io/connecthing-api"); // Required for local API calls
const fs = require("fs");

const app = express();

app.get('/', function (req, res) {
  res.send('connecthing.io node microservice!');
});

const SERVER_PORT = 8080;
app.listen(SERVER_PORT, function () {
  console.log('connecthing.io node microservice listening on port ' + SERVER_PORT + '!');
});

const ConsumerGroup = kafka.ConsumerGroup;
const consumer = new ConsumerGroup({
    kafkaHost: process.env.KAFKA_HOST,
    groupId: process.env.KAFKA_CONSUMER_GROUP_ID,
    fromOffset: "earliest",
    ssl: true,
    sslOptions: {
        key: fs.readFileSync('/etc/davra/tls/tls.key'),
        cert: fs.readFileSync('/etc/davra/tls/tls.crt'),
        ca: [ fs.readFileSync("/etc/davra/tls/ca-cert") ],
        rejectUnauthorized: false
    } 
  },
  [ process.env.IoT_DATA_TOPIC_NAME ]);

consumer.on('error', function (err) {
	console.error("Kafka consumer group reporting error", err);
	console.error(err.stack);  
	process.exit(1);
});

var simplePutDataIntoTimeSeriesDb = function(deviceUuid, metricValue, callback) {
    console.log('Putting the following data into the db: ', deviceUuid, metricValue);
    var dataToSend = {
        "UUID": deviceUuid,
        "name": "mydomain.someEvent",
        "value": metricValue,
        "msg_type": "event"
    }
    api.request({
        url: "http://api.connecthing/api/v1/iotdata",
        contentType: "application/json",
        body: JSON.stringify(dataToSend),
        method: "PUT",
        callback: function(err, response, body){
            if(callback) {
                callback(err, response);
            }
        }
    });
};

let lastDatumValue = 1

consumer.on("message", function(message){
    const datum = JSON.parse(message.value)
    if (datum.name === "eightwest.interestingValue") {
        console.dir(message);
        if (datum.value !== lastDatumValue && (datum.value == 1 || datum.value == 2)) {
            console.log('Value changed to', datum.value, 'from', lastDatumValue)
            var eventValue = {
                newValue: datum.value,
                oldValue: lastDatumValue
            }
            simplePutDataIntoTimeSeriesDb(datum.UUID, eventValue, (err, response) => {
                console.log('Response from timeseries', response.statusCode)
            })
        }
    }
});
