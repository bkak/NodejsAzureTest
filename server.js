

// server.js is the starting point of the host process:
//
// `node server.js` 
var express = require('express')
  , http = require('http')
  , colors = require('./colors')
  , socket = require('socket.io')
  , contextEventDenormalizer = require('cqrs-eventdenormalizer').contextEventDenormalizer
  , repository = require('viewmodel').read,
    logger = require('./logger');

// create an configure:
//
// - express webserver
// - socket.io socket communication from/to browser
var app = express()
  , server = http.createServer(app)
  , io = socket.listen(server);

app.configure(function() {
    app.use(express.bodyParser());
    app.use(express['static'](__dirname + '/host/public'));
    
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/host/app/views');
});

io.configure(function() {
    io.set('log level', 1);
});

// BOOTSTRAPPING
console.log('\nBOOTSTRAPPING:'.cyan);

var options = {
    denormalizersPath: __dirname + '/eventDenormalizers',
    repository: {
        type: 'inMemory', //'mongoDb',
        dbName: 'cqrssample'
    },
    eventQueue: {
        type: 'inMemory', //'mongoDb',
        dbName: 'cqrssample'
    }
};

console.log('1. -> viewmodel'.cyan);
repository.init(options.repository, function(err) {

    console.log('2. -> eventdenormalizer'.cyan);
    contextEventDenormalizer.initialize(options, function(err) {
        if(err) {
            console.log(err);
        }

        console.log('3. -> routes'.cyan);
        require('./host/app/routes').actions(app, options);

        console.log('4. -> message bus'.cyan);
        var msgbus = require('./msgbus');

        // on receiving an __event__ from redis via the hub module:
        //
        // - let it be handled from the eventDenormalizer to update the viewmodel storage
        msgbus.onEvent(function(data) {
            console.log(colors.cyan('eventDenormalizer -- denormalize event ' + data.event));
            contextEventDenormalizer.denormalize(data);
        });

        // on receiving an __event__ from contextEventDenormalizer module:
        //
        // - forward it to connected browsers via socket.io
        contextEventDenormalizer.on('event', function(evt) {
            console.log(colors.magenta('\nsocket.io -- publish event ' + evt.event + ' to browser'));
            io.sockets.emit('events', evt);
        });

        // SETUP COMMUNICATION CHANNELS

        // on receiving __commands__ from browser via socket.io emit them on the ĥub module (which will 
        // forward it to message bus (redis pubsub))
        io.sockets.on('connection', function(socket) {
            var conn = socket.handshake.address.address + ":" + socket.handshake.address.port;
            console.log(colors.magenta(conn + ' -- connects to socket.io'));
            
            socket.on('commands', function(data) {
                console.log(colors.magenta('\n' + conn + ' -- sends command ' + data.command + ':'));
                console.log(data);

                msgbus.emitCommand(data);
                //io.sockets.emit('events', 'data from server');
            });
        });

        // START LISTENING
        var port = process.env.port || 1337;
        console.log(colors.cyan('\nStarting server on port ' + port));
        server.listen(port);
        logger.write("test");
    });
});

function WriteToFile(text){
    var fs = require('fs');
    var stream = fs.createWriteStream("my_file.txt");
    stream.once('open', function(fd) {
        stream.write(text + "\n");
        stream.end();
    });
}